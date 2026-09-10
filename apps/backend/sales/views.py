import csv
import uuid
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission, HasModuleSubscription
from core.tenancy import get_active_membership, get_active_organization
from core.property_scope import scope_model_queryset, scope_queryset_to_property
from rest_framework.exceptions import PermissionDenied

from .models import AgentCommission, Buyer, BuyerPortalAccess, Installment, ListingRender, PropertySale, SaleDocument, SaleListing, SalePayment, SalesAuditEvent, SiteVisit
from .serializers import AgentCommissionSerializer, BuyerSerializer, BuyerPortalAccessSerializer, InstallmentSerializer, ListingRenderSerializer, PropertySaleSerializer, SaleDocumentSerializer, SaleListingSerializer, SalePaymentSerializer, SalesAuditEventSerializer, SiteVisitSerializer


class SalesModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.SALES
    search_fields = ()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = scope_queryset_to_property(self.queryset.for_organization(organization), self.request, organization)
        search = self.request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f'{field}__icontains': search})
            queryset = queryset.filter(query)
        status = self.request.query_params.get('status')
        if status and any(field.name == 'status' for field in queryset.model._meta.fields):
            queryset = queryset.filter(status=status)
        return queryset

    def _validate_organization(self, serializer):
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            if getattr(value, 'organization_id', organization.id) != organization.id:
                raise ValidationError({name: 'The selected record belongs to another organization.'})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class ListingViewSet(SalesModelViewSet):
    write_permission = 'sales.selling'
    queryset = SaleListing.objects.select_related('unit', 'project')
    serializer_class = SaleListingSerializer
    search_fields = ('unit__code', 'unit__unit_type', 'project__name')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer), status=SaleListing.Status.AVAILABLE,
            reservation_expires_at=None,
        )

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='expire-reservations')
    def expire_reservations(self, request):
        organization = get_active_organization(request)
        listings = SaleListing.objects.select_for_update().filter(
            organization=organization, status=SaleListing.Status.RESERVED,
            reservation_expires_at__lt=timezone.now(),
        )
        expired = 0
        for listing in listings:
            sale = listing.sales.filter(status=PropertySale.Status.RESERVED).order_by('-created_at').first()
            if sale:
                sale.status = PropertySale.Status.CANCELLED
                sale.cancellation_reason = 'Reservation expired automatically.'
                sale.save(update_fields=('status', 'cancellation_reason', 'updated_at'))
                SalesAuditEvent.objects.create(
                    organization=organization, sale=sale, event_type='reservation_expired',
                    from_status=PropertySale.Status.RESERVED, to_status=PropertySale.Status.CANCELLED,
                    notes=sale.cancellation_reason, actor=request.user,
                )
            listing.status = SaleListing.Status.AVAILABLE
            listing.reservation_expires_at = None
            listing.save(update_fields=('status', 'reservation_expires_at', 'updated_at'))
            expired += 1
        return Response({'expired': expired})


class ListingRenderViewSet(SalesModelViewSet):
    write_permission = 'sales.selling'
    queryset = ListingRender.objects.select_related('listing__unit', 'listing__project')
    serializer_class = ListingRenderSerializer
    search_fields = ('title', 'caption', 'listing__unit__code', 'listing__reference')

    def perform_create(self, serializer):
        listing = serializer.validated_data.get('listing')
        organization = get_active_organization(self.request)
        if not listing or listing.organization_id != organization.id:
            raise ValidationError({'listing': 'The listing does not belong to the active organization.'})
        render_kind = serializer.validated_data.get('render_kind', ListingRender.RenderKind.RENDER)
        uploaded = serializer.validated_data.get('file')
        mime_type = ''
        file_size = 0
        if uploaded:
            mime_type = getattr(uploaded, 'content_type', '') or ''
            file_size = uploaded.size or 0
        if render_kind == ListingRender.RenderKind.MODEL_3D and not (uploaded or serializer.validated_data.get('file_url')):
            raise ValidationError({'file': 'A 3D model (.glb/.gltf) or a model URL is required.'})
        is_primary = serializer.validated_data.get('is_primary')
        instance = serializer.save(organization=organization, mime_type=mime_type, file_size=file_size)
        if is_primary:
            ListingRender.objects.filter(organization=organization, listing=instance.listing).exclude(pk=instance.pk).update(is_primary=False)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()


class BuyerViewSet(SalesModelViewSet):
    write_permission = 'sales.selling'
    permission_map = {'transition': 'sales.selling'}
    queryset = Buyer.objects.select_related('assigned_agent')
    serializer_class = BuyerSerializer
    search_fields = ('reference', 'full_name', 'email', 'phone', 'id_number')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer), status=Buyer.Status.LEAD,
            confirmed_at=None,
        )

    def perform_update(self, serializer):
        if serializer.instance.status in (Buyer.Status.COMPLETED, Buyer.Status.CANCELLED):
            raise ValidationError({'buyer': 'Closed buyer records are immutable.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    def transition(self, request, pk=None):
        buyer = self.get_object()
        target = str(request.data.get('status', '')).strip()
        allowed = {
            Buyer.Status.LEAD: {Buyer.Status.QUALIFIED, Buyer.Status.CANCELLED},
            Buyer.Status.QUALIFIED: {Buyer.Status.ACTIVE, Buyer.Status.CANCELLED},
            Buyer.Status.ACTIVE: {Buyer.Status.COMPLETED, Buyer.Status.CANCELLED},
            Buyer.Status.COMPLETED: set(), Buyer.Status.CANCELLED: set(),
        }
        if target not in allowed[buyer.status]:
            raise ValidationError({'status': f'Cannot transition buyer from {buyer.status} to {target or "blank"}.'})
        buyer.status = target
        if target == Buyer.Status.ACTIVE and buyer.confirmed_at is None:
            buyer.confirmed_at = timezone.now()
        buyer.save(update_fields=('status', 'confirmed_at', 'updated_at'))
        return Response(self.get_serializer(buyer).data)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @action(detail=True, methods=('get',), url_path='profile')
    def profile(self, request, pk=None):
        """Aggregated 360° view of a buyer: sales, plan, payments, documents, visits."""
        buyer = self.get_object()
        organization = get_active_organization(request)
        sales = PropertySale.objects.for_organization(organization).filter(
            buyer=buyer,
        ).select_related('listing__unit', 'listing__project', 'agent').prefetch_related('payments').order_by('-created_at')
        installments = Installment.objects.for_organization(organization).filter(
            sale__buyer=buyer,
        ).select_related('sale').order_by('due_on')
        payments = SalePayment.objects.for_organization(organization).filter(
            sale__buyer=buyer,
        ).select_related('sale', 'installment').order_by('-paid_on')
        documents = SaleDocument.objects.for_organization(organization).filter(
            sale__buyer=buyer,
        ).select_related('sale').order_by('document_type', 'title')
        visits = SiteVisit.objects.for_organization(organization).filter(
            converted_buyer=buyer,
        ).select_related('project').order_by('-visited_at')

        today = timezone.localdate()
        active_sales = [s for s in sales if s.status != PropertySale.Status.CANCELLED]
        total_value = sum((s.agreed_price for s in active_sales), Decimal('0'))
        verified_paid = sum(
            (p.amount for p in payments if p.status == SalePayment.Status.VERIFIED), Decimal('0'),
        )
        overdue = [i for i in installments if i.status != Installment.Status.PAID and i.due_on < today]
        overdue_amount = sum((i.amount - i.paid_amount for i in overdue), Decimal('0'))
        next_due = next((i for i in installments if i.status not in (Installment.Status.PAID,)), None)
        return Response({
            'buyer': BuyerSerializer(buyer).data,
            'sales': PropertySaleSerializer(sales, many=True, context={'request': request}).data,
            'installments': InstallmentSerializer(installments, many=True).data,
            'payments': SalePaymentSerializer(payments, many=True).data,
            'documents': SaleDocumentSerializer(documents, many=True).data,
            'visits': SiteVisitSerializer(visits, many=True).data,
            'summary': {
                'activeSales': len(active_sales),
                'totalValue': total_value,
                'verifiedPaid': verified_paid,
                'outstanding': max(total_value - verified_paid, Decimal('0')),
                'overdueCount': len(overdue),
                'overdueAmount': overdue_amount,
                'nextDueOn': next_due.due_on if next_due else None,
                'nextDueAmount': (next_due.amount - next_due.paid_amount) if next_due else Decimal('0'),
                'collectionRate': round(float(verified_paid / total_value * 100), 1) if total_value else 0.0,
            },
        })


class SaleViewSet(SalesModelViewSet):
    write_permission = 'sales.selling'
    permission_map = {'transition': 'sales.selling'}
    queryset = PropertySale.objects.select_related('buyer', 'listing__unit', 'listing__project', 'agent').prefetch_related('payments')
    serializer_class = PropertySaleSerializer
    search_fields = ('reference', 'buyer__full_name', 'listing__unit__code', 'listing__project__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        sale = serializer.save(organization=organization, status=PropertySale.Status.DRAFT)
        SalesAuditEvent.objects.create(organization=organization, sale=sale, event_type='created', to_status=sale.status, actor=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.status in (PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED):
            raise ValidationError({'sale': 'Completed or cancelled sales are immutable.'})
        if 'status' in serializer.validated_data and serializer.validated_data['status'] != self.get_object().status:
            raise ValidationError({'status': 'Use the transition action so inventory and audit controls are applied.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def transition(self, request, pk=None):
        organization = get_active_organization(request)
        sale = PropertySale.objects.select_for_update().select_related('listing__unit').filter(pk=pk, organization=organization).first()
        if not sale:
            return Response({'detail': 'Sale not found.'}, status=404)
        target = str(request.data.get('status', '')).strip()
        allowed = {
            PropertySale.Status.DRAFT: {PropertySale.Status.RESERVED, PropertySale.Status.CANCELLED},
            PropertySale.Status.RESERVED: {PropertySale.Status.CONTRACTED, PropertySale.Status.CANCELLED},
            PropertySale.Status.CONTRACTED: {PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED},
            PropertySale.Status.COMPLETED: set(), PropertySale.Status.CANCELLED: set(),
        }
        if target not in allowed[sale.status]:
            raise ValidationError({'status': f'Cannot transition from {sale.status} to {target or "blank"}.'})
        listing = SaleListing.objects.select_for_update().get(pk=sale.listing_id)
        notes = str(request.data.get('notes', '')).strip()
        verified_total = sale.payments.filter(status=SalePayment.Status.VERIFIED).aggregate(total=Sum('amount'))['total'] or Decimal(0)
        previous = sale.status
        if target == PropertySale.Status.RESERVED:
            if listing.status != SaleListing.Status.AVAILABLE:
                raise ValidationError({'listing': 'The unit is not available for reservation.'})
            sale.reserved_at = timezone.now()
            listing.status = SaleListing.Status.RESERVED
            listing.reservation_expires_at = request.data.get('reservation_expires_at') or timezone.now() + timezone.timedelta(days=14)
        elif target == PropertySale.Status.CONTRACTED:
            if verified_total < sale.reservation_fee:
                raise ValidationError({'payment': 'Verified payments must cover the reservation fee before contracting.'})
            sale.contracted_on = request.data.get('contracted_on') or timezone.localdate()
        elif target == PropertySale.Status.COMPLETED:
            if verified_total < sale.agreed_price:
                raise ValidationError({'payment': 'The full sale price must be verified before completion.'})
            listing.status = SaleListing.Status.SOLD
            listing.unit.status = 'sold'
            listing.unit.save(update_fields=('status', 'updated_at'))
        elif target == PropertySale.Status.CANCELLED:
            if not notes:
                raise ValidationError({'notes': 'A cancellation reason is required.'})
            sale.cancellation_reason = notes
            listing.status = SaleListing.Status.AVAILABLE
            listing.reservation_expires_at = None
        sale.status = target
        sale.save()
        listing.save()
        SalesAuditEvent.objects.create(
            organization=organization, sale=sale, event_type='sale_status_change',
            from_status=previous, to_status=target, notes=notes,
            details={'verified_total': str(verified_total)}, actor=request.user,
        )
        return Response(PropertySaleSerializer(sale).data)


class InstallmentViewSet(SalesModelViewSet):
    write_permission = 'sales.payments'
    queryset = Installment.objects.select_related('sale__buyer')
    serializer_class = InstallmentSerializer
    search_fields = ('sale__reference', 'sale__buyer__full_name', 'description', 'milestone')

    def perform_create(self, serializer):
        due_on = serializer.validated_data['due_on']
        serializer.save(
            organization=self._validate_organization(serializer), paid_amount=Decimal('0'),
            status=Installment.Status.DUE if due_on <= timezone.localdate() else Installment.Status.UPCOMING,
        )

    def perform_update(self, serializer):
        if serializer.instance.paid_amount > 0:
            raise ValidationError({'installment': 'An installment with allocations cannot be edited.'})
        super().perform_update(serializer)

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @action(detail=False, methods=('get',), url_path='aging')
    def aging(self, request):
        """Collections cockpit: aging buckets, expected vs collected, top exposures."""
        organization = get_active_organization(request)
        today = timezone.localdate()
        installments = list(
            scope_model_queryset(Installment, request, organization)
            .select_related('sale__buyer', 'sale__listing__project')
        )
        buckets = {'current': Decimal('0'), 'd1_30': Decimal('0'), 'd31_60': Decimal('0'), 'd61_90': Decimal('0'), 'd90_plus': Decimal('0')}
        bucket_counts = {key: 0 for key in buckets}
        expected = Decimal('0')
        collected = Decimal('0')
        exposures: dict[str, dict] = {}

        for inst in installments:
            expected += inst.amount
            collected += inst.paid_amount
            balance = inst.amount - inst.paid_amount
            if inst.status == Installment.Status.PAID or balance <= 0:
                continue
            days = (today - inst.due_on).days
            if days <= 0:
                key = 'current'
            elif days <= 30:
                key = 'd1_30'
            elif days <= 60:
                key = 'd31_60'
            elif days <= 90:
                key = 'd61_90'
            else:
                key = 'd90_plus'
            buckets[key] += balance
            bucket_counts[key] += 1
            if days > 0:
                sale = inst.sale
                row = exposures.setdefault(str(sale.id), {
                    'sale': sale.reference,
                    'buyer': sale.buyer.full_name,
                    'project': sale.listing.project.name if sale.listing_id and sale.listing.project_id else '',
                    'outstanding': Decimal('0'),
                    'oldest_days': 0,
                })
                row['outstanding'] += balance
                row['oldest_days'] = max(row['oldest_days'], days)

        top = sorted(exposures.values(), key=lambda r: r['outstanding'], reverse=True)[:10]
        outstanding = expected - collected
        return Response({
            'asOf': today,
            'totals': {
                'expected': expected,
                'collected': collected,
                'outstanding': outstanding,
                'overdue': sum((buckets[k] for k in ('d1_30', 'd31_60', 'd61_90', 'd90_plus')), Decimal('0')),
                'collectionRate': round(float(collected / expected * 100), 1) if expected else 0.0,
            },
            'buckets': [
                {'key': 'current', 'label': 'Not yet due', 'amount': buckets['current'], 'count': bucket_counts['current']},
                {'key': 'd1_30', 'label': '1–30 days', 'amount': buckets['d1_30'], 'count': bucket_counts['d1_30']},
                {'key': 'd31_60', 'label': '31–60 days', 'amount': buckets['d31_60'], 'count': bucket_counts['d31_60']},
                {'key': 'd61_90', 'label': '61–90 days', 'amount': buckets['d61_90'], 'count': bucket_counts['d61_90']},
                {'key': 'd90_plus', 'label': '90+ days', 'amount': buckets['d90_plus'], 'count': bucket_counts['d90_plus']},
            ],
            'topExposures': top,
        })


class PaymentViewSet(SalesModelViewSet):
    write_permission = 'sales.payments'
    queryset = SalePayment.objects.select_related('sale__buyer', 'installment', 'verified_by')
    serializer_class = SalePaymentSerializer
    search_fields = ('reference', 'external_reference', 'sale__reference', 'sale__buyer__full_name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        payment = serializer.save(
            organization=organization, status=SalePayment.Status.PENDING,
            verified_by=None, verified_at=None, rejection_reason='',
        )
        SalesAuditEvent.objects.create(organization=organization, sale=payment.sale, payment=payment, event_type='payment_submitted', to_status=payment.status, actor=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.status != SalePayment.Status.PENDING:
            raise ValidationError({'payment': 'Only pending payment submissions can be edited.'})
        protected = {'status', 'verified_by', 'verified_at', 'rejection_reason'} & set(serializer.validated_data)
        if protected:
            raise ValidationError({'payment': 'Use verification actions for controlled payment status changes.'})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        raise ValidationError({'payment': 'Payment records are permanent; reject or reverse them instead.'})

    def _recalculate_commissions(self, sale):
        verified_total = sale.payments.filter(status=SalePayment.Status.VERIFIED).aggregate(total=Sum('amount'))['total'] or Decimal(0)
        paid_percent = verified_total / sale.agreed_price * 100 if sale.agreed_price else Decimal(0)
        construction_percent = sale.listing.construction_progress
        for commission in sale.commissions.exclude(status__in=(AgentCommission.Status.PAID, AgentCommission.Status.APPROVED)):
            commission.status = AgentCommission.Status.ELIGIBLE if (
                paid_percent >= commission.required_paid_percent
                and construction_percent >= commission.required_construction_percent
            ) else AgentCommission.Status.PENDING
            commission.save(update_fields=('status', 'updated_at'))

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def verify(self, request, pk=None):
        organization = get_active_organization(request)
        # Lock only the payment row. ``installment`` is nullable, so asking
        # PostgreSQL to lock a select_related outer join raises
        # "FOR UPDATE cannot be applied to the nullable side of an outer join".
        payment = SalePayment.objects.select_for_update().filter(pk=pk, organization=organization).first()
        if not payment:
            return Response({'detail': 'Payment not found.'}, status=404)
        if payment.status != SalePayment.Status.PENDING:
            raise ValidationError({'status': 'Only pending payments can be verified.'})
        if not payment.installment_id:
            raise ValidationError({'installment': 'Select an installment before verification.'})
        installment = Installment.objects.select_for_update().get(pk=payment.installment_id)
        remaining = installment.amount - installment.paid_amount
        if payment.amount > remaining:
            raise ValidationError({'amount': 'Payment exceeds the installment balance.'})
        installment.paid_amount += payment.amount
        installment.status = Installment.Status.PAID if installment.paid_amount == installment.amount else Installment.Status.PARTIAL
        installment.save()
        payment.status = SalePayment.Status.VERIFIED
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.rejection_reason = ''
        payment.save()
        self._recalculate_commissions(payment.sale)
        SalesAuditEvent.objects.create(organization=organization, sale=payment.sale, payment=payment, event_type='payment_verified', from_status='pending', to_status='verified', details={'allocated': str(payment.amount), 'installment': installment.sequence}, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reject(self, request, pk=None):
        payment = SalePayment.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        reason = str(request.data.get('reason', '')).strip()
        if not payment or payment.status != SalePayment.Status.PENDING:
            raise ValidationError({'status': 'Only pending payments can be rejected.'})
        if not reason:
            raise ValidationError({'reason': 'A rejection reason is required.'})
        payment.status = SalePayment.Status.REJECTED; payment.rejection_reason = reason; payment.save()
        SalesAuditEvent.objects.create(organization=payment.organization, sale=payment.sale, payment=payment, event_type='payment_rejected', from_status='pending', to_status='rejected', notes=reason, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reverse(self, request, pk=None):
        payment = SalePayment.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        reason = str(request.data.get('reason', '')).strip()
        if not payment or payment.status != SalePayment.Status.VERIFIED:
            raise ValidationError({'status': 'Only verified payments can be reversed.'})
        if not reason:
            raise ValidationError({'reason': 'A reversal reason is required.'})
        if payment.installment_id:
            installment = Installment.objects.select_for_update().get(pk=payment.installment_id)
            installment.paid_amount = max(Decimal(0), installment.paid_amount - payment.amount)
            if installment.paid_amount == 0:
                installment.status = Installment.Status.DUE if installment.due_on <= timezone.localdate() else Installment.Status.UPCOMING
            elif installment.paid_amount < installment.amount:
                installment.status = Installment.Status.PARTIAL
            installment.save()
        payment.status = SalePayment.Status.REVERSED
        payment.rejection_reason = reason
        payment.save()
        self._recalculate_commissions(payment.sale)
        SalesAuditEvent.objects.create(organization=payment.organization, sale=payment.sale, payment=payment, event_type='payment_reversed', from_status='verified', to_status='reversed', notes=reason, details={'amount': str(payment.amount)}, actor=request.user)
        return Response(SalePaymentSerializer(payment).data)


class SiteVisitViewSet(SalesModelViewSet):
    write_permission = 'sales.visits'
    queryset = SiteVisit.objects.select_related('project', 'introducing_agent', 'converted_buyer')
    serializer_class = SiteVisitSerializer
    search_fields = ('reference', 'visitor_name', 'email', 'phone', 'project__name')


class CommissionViewSet(SalesModelViewSet):
    write_permission = 'sales.payments'
    queryset = AgentCommission.objects.select_related('sale__buyer', 'agent')
    serializer_class = AgentCommissionSerializer
    search_fields = ('reference', 'sale__reference', 'sale__buyer__full_name', 'agent__username')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), status=AgentCommission.Status.PENDING)

    def perform_update(self, serializer):
        if serializer.instance.status not in (AgentCommission.Status.PENDING, AgentCommission.Status.HELD):
            raise ValidationError({'commission': 'Eligible, approved or paid commissions cannot be edited.'})
        super().perform_update(serializer)

    def _transition(self, commission, allowed, status, notes=''):
        if commission.status not in allowed:
            raise ValidationError({'status': f'Commission cannot move from {commission.status} to {status}.'})
        previous = commission.status
        commission.status = status
        if status == AgentCommission.Status.APPROVED:
            commission.approved_at = timezone.now()
        if status == AgentCommission.Status.PAID:
            commission.paid_on = timezone.localdate()
        commission.save()
        SalesAuditEvent.objects.create(
            organization=commission.organization, sale=commission.sale,
            event_type='commission_status_change', from_status=previous, to_status=status,
            notes=notes, details={'commission': commission.reference, 'amount': str(commission.amount)},
            actor=self.request.user,
        )
        return Response(self.get_serializer(commission).data)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        return self._transition(self.get_object(), (AgentCommission.Status.ELIGIBLE,), AgentCommission.Status.APPROVED)

    @action(detail=True, methods=('post',))
    def hold(self, request, pk=None):
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            raise ValidationError({'reason': 'A hold reason is required.'})
        return self._transition(
            self.get_object(), (AgentCommission.Status.PENDING, AgentCommission.Status.ELIGIBLE),
            AgentCommission.Status.HELD, reason,
        )

    @action(detail=True, methods=('post',), url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        return self._transition(self.get_object(), (AgentCommission.Status.APPROVED,), AgentCommission.Status.PAID)


class SaleDocumentViewSet(SalesModelViewSet):
    write_permission = 'sales.legal'
    queryset = SaleDocument.objects.select_related('sale')
    serializer_class = SaleDocumentSerializer
    search_fields = ('title', 'document_type', 'sale__reference')

    def perform_update(self, serializer):
        raise ValidationError({'document': 'Legal documents are immutable; upload a new checksum version.'})

    def perform_destroy(self, instance):
        raise ValidationError({'document': 'Legal documents cannot be deleted.'})


class SalesAuditEventViewSet(SalesModelViewSet):
    queryset = SalesAuditEvent.objects.select_related('sale', 'payment', 'actor')
    serializer_class = SalesAuditEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('sale__reference', 'payment__reference', 'event_type', 'notes')


class SalesDashboardViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.SALES

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        listings = scope_model_queryset(SaleListing, request, organization)
        sales = scope_model_queryset(PropertySale, request, organization)
        payments = scope_model_queryset(SalePayment, request, organization)
        visits = scope_model_queryset(SiteVisit, request, organization)
        commissions = scope_model_queryset(AgentCommission, request, organization)
        verified = payments.filter(status=SalePayment.Status.VERIFIED)
        pipeline = sales.exclude(status__in=(PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED))
        return Response({
            'kpis': {
                'availableUnits': listings.filter(status=SaleListing.Status.AVAILABLE).count(),
                'reservedUnits': listings.filter(status=SaleListing.Status.RESERVED).count(),
                'soldUnits': listings.filter(status=SaleListing.Status.SOLD).count(),
                'salesValue': sales.exclude(status=PropertySale.Status.CANCELLED).aggregate(total=Sum('agreed_price'))['total'] or 0,
                'verifiedPayments': verified.aggregate(total=Sum('amount'))['total'] or 0,
                'pendingPayments': payments.filter(status=SalePayment.Status.PENDING).count(),
                'activeBuyers': scope_model_queryset(Buyer, request, organization).filter(status__in=(Buyer.Status.QUALIFIED, Buyer.Status.ACTIVE)).count(),
                'siteVisits': visits.count(), 'pipelineDeals': pipeline.count(),
                'pendingCommissions': commissions.exclude(status=AgentCommission.Status.PAID).aggregate(total=Sum('amount'))['total'] or 0,
            },
            'recentSales': PropertySaleSerializer(sales[:6], many=True).data,
            'pendingPayments': SalePaymentSerializer(payments.filter(status=SalePayment.Status.PENDING)[:5], many=True).data,
            'inventoryByStatus': list(listings.values('status').annotate(count=Count('id')).order_by('status')),
            'salesByProject': list(sales.values('listing__project__name').annotate(count=Count('id'), value=Sum('agreed_price')).order_by('-value')),
        })


class SalesAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.SALES

    def _organization(self):
        return get_active_organization(self.request)

    def _queries(self):
        organization = self._organization()
        return {
            'listings': scope_model_queryset(SaleListing, self.request, organization),
            'sales': scope_model_queryset(PropertySale, self.request, organization),
            'payments': scope_model_queryset(SalePayment, self.request, organization),
            'installments': scope_model_queryset(Installment, self.request, organization),
            'commissions': scope_model_queryset(AgentCommission, self.request, organization),
            'buyers': scope_model_queryset(Buyer, self.request, organization),
            'visits': scope_model_queryset(SiteVisit, self.request, organization),
        }

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = self._organization()
        performance = scope_model_queryset(PropertySale, request, organization).values(
            'agent__id', 'agent__username', 'agent__first_name', 'agent__last_name',
        ).annotate(
            deals=Count('id'), value=Sum('agreed_price'),
            completed=Count('id', filter=Q(status=PropertySale.Status.COMPLETED)),
            cancelled=Count('id', filter=Q(status=PropertySale.Status.CANCELLED)),
        ).order_by('-value')
        overdue = scope_model_queryset(Installment, request, organization).filter(
            due_on__lt=timezone.localdate(),
        ).exclude(status=Installment.Status.PAID).aggregate(
            amount=Sum('amount'), paid=Sum('paid_amount'), count=Count('id'),
        )
        from .reporting import CATALOGUE
        return Response({
            'agentPerformance': list(performance),
            'installmentExposure': {
                'count': overdue['count'] or 0,
                'outstanding': (overdue['amount'] or Decimal('0')) - (overdue['paid'] or Decimal('0')),
            },
            'reports': CATALOGUE,
        })

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @action(detail=False, methods=('get',), url_path=r'reports/(?P<report_kind>[^/.]+)')
    def summary(self, request, report_kind=None):
        """In-app report preview: KPIs, columns and rows for a report."""
        from .reporting import build_report, resolve_report_key
        report_kind = resolve_report_key(report_kind)
        headers, rows, start, end = build_report(request, self._queries(), report_kind)
        organization = self._organization()
        return Response({
            'key': report_kind,
            'period': {'start': start.isoformat(), 'end': end.isoformat()},
            'columns': list(headers),
            'rows': rows,
            'count': len(rows),
            'meta': {
                'title': '',
                'organization': organization.name,
                'generated_by': request.user.get_full_name() or request.user.get_username(),
                'generated_at': timezone.localtime().isoformat(),
            },
        })

    @extend_schema(request=None, responses={200: {"type": "string", "format": "binary"}}, parameters=[
        OpenApiParameter("report_kind", OpenApiTypes.STR, OpenApiParameter.PATH),
        OpenApiParameter("output", OpenApiTypes.STR, OpenApiParameter.QUERY),
    ])
    @action(detail=False, methods=('get',), url_path=r'exports/(?P<report_kind>[^/.]+)')
    def export(self, request, report_kind=None):
        organization = self._organization()
        output_format = request.query_params.get('output', 'csv').lower()
        if output_format not in ('csv', 'xlsx'):
            raise ValidationError({'output': 'Output format must be csv or xlsx.'})
        from .reporting import build_report, resolve_report_key, cell_value
        report_kind = resolve_report_key(report_kind)
        headers, rows, start, end = build_report(request, self._queries(), report_kind)
        from .reporting import CATALOGUE, REPORTS
        friendly = next((r['name'] for r in CATALOGUE if r['key'] == report_kind), REPORTS.get(report_kind, {}).get('title', report_kind.replace('-', ' ').title()))

        from io import StringIO
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([cell_value(row, h) for h in headers])

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="sales-{report_kind}-{start:%Y%m%d}-{end:%Y%m%d}.{output_format}"'

        if output_format == 'xlsx':
            try:
                from openpyxl import Workbook
            except ImportError:
                raise ValidationError({'output': 'Excel export is not available.'})
            from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
            workbook = Workbook()
            sheet = workbook.active
            sheet.title = friendly[:31]
            sheet['A1'] = friendly
            sheet['A1'].font = Font(name='Calibri', size=14, bold=True, color='17243B')
            sheet['A2'] = f'{organization.name} · {start:%d %b %Y} — {end:%d %b %Y}'
            sheet['A2'].font = Font(name='Calibri', size=10, color='64748B')
            sheet['A3'] = f"Prepared by {request.user.get_full_name() or request.user.get_username()} · Generated {timezone.localtime():%d %b %Y %H:%M}"
            sheet['A3'].font = Font(name='Calibri', size=9, color='64748B')
            header_fill = PatternFill('solid', fgColor='17243B')
            header_font = Font(color='FFFFFF', bold=True, name='Calibri', size=11)
            body_font = Font(name='Calibri', size=10)
            zebra = PatternFill('solid', fgColor='F4F7FA')
            thin = Border(*(Side(style='thin', color='DBE3EC'),) * 4)
            start_row = 5
            money_keywords = ('amount', 'price', 'value', 'balance', 'fee', 'paid', 'gate', 'cost', 'total', 'income')
            money_headers = {i for i, h in enumerate(headers) if any(k in str(h).lower() for k in money_keywords) and '%' not in str(h)}
            percent_headers = {i for i, h in enumerate(headers) if '%' in str(h)}
            width_hints = max(min(max(len(str(h)) + 6, 12), 34) for h in headers)
            row_index = start_row
            for col_index, value in enumerate(headers, start=1):
                cell = sheet.cell(row=row_index, column=col_index, value=value)
                cell.font = header_font
                cell.fill = header_fill
                cell.border = thin
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            sheet.column_dimensions['A'].width = width_hints
            for data_index, row in enumerate(rows, start=start_row + 1):
                sheet.row_dimensions[data_index].height = 16
                for col_index, header in enumerate(headers, start=1):
                    zero_idx = col_index - 1
                    value = cell_value(row, header)
                    try:
                        if zero_idx in money_headers and value not in (None, '', '—'):
                            cell = sheet.cell(row=data_index, column=col_index, value=Decimal(str(value).replace(',', '')))
                            cell.number_format = '#,##0.00'
                            cell.alignment = Alignment(horizontal='right', vertical='center')
                        elif zero_idx in percent_headers and value not in (None, '', '—'):
                            cell = sheet.cell(row=data_index, column=col_index, value=float(str(value).replace('%', '')))
                            cell.number_format = '0.0"% "'
                            cell.alignment = Alignment(horizontal='right', vertical='center')
                        else:
                            cell = sheet.cell(row=data_index, column=col_index, value=value)
                            cell.alignment = Alignment(vertical='center')
                    except (TypeError, ValueError):
                        cell = sheet.cell(row=data_index, column=col_index, value=value)
                        cell.alignment = Alignment(vertical='center')
                    cell.font = body_font
                    cell.border = thin
                    if (data_index - start_row) % 2 == 0:
                        cell.fill = zebra
            from io import BytesIO
            byte_io = BytesIO()
            workbook.save(byte_io)
            byte_io.seek(0)
            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="sales-{report_kind}-{start:%Y%m%d}-{end:%Y%m%d}.xlsx"'
            response.write(byte_io.getvalue())
        else:
            response.write(buffer.getvalue().encode('utf-8'))

        # Audit the export
        self._audit_export(organization, request, report_kind, friendly, output_format, start, end, len(rows))
        return response

    def _audit_export(self, organization, request, report_key, friendly, output_format, start, end, row_count):
        try:
            from properties.models import ReportDefinition, ReportExecution
            from django.utils import timezone as tz
            definition = ReportDefinition.objects.for_organization(organization).filter(
                key=report_key, is_active=True,
            ).first()
            if not definition:
                definition = ReportDefinition.objects.create(
                    organization=organization, key=report_key, name=friendly,
                    domain=ReportDefinition.Domain.FINANCIAL, description=friendly,
                    is_standard=True, created_by=request.user,
                )
            ReportExecution.objects.create(
                organization=organization, definition=definition, report_key=report_key,
                period_start=start, period_end=end, filters={'scope': 'organization'},
                output_format=output_format, status=ReportExecution.Status.COMPLETED,
                generated_by=request.user, generated_at=tz.now(), row_count=row_count,
            )
        except Exception:
            # Reporting must never fail because audit logging did.
            pass



class BuyerPortalAccessViewSet(SalesModelViewSet):
    write_permission = 'sales.selling'
    queryset = BuyerPortalAccess.objects.select_related('user', 'buyer')
    serializer_class = BuyerPortalAccessSerializer
    search_fields = ('user__username', 'buyer__full_name', 'buyer__reference')


class BuyerPortalViewSet(ViewSet):
    """Self-service portal for buyers linked to this account via BuyerPortalAccess."""

    permission_classes = (HasModuleSubscription,)
    required_module = Module.SALES

    def _access(self, buyer_id=None):
        organization = get_active_organization(self.request)
        if buyer_id:
            membership = get_active_membership(self.request, organization)
            can_support = (
                self.request.user.is_staff or self.request.user.is_superuser
                or bool(membership and (
                    membership.is_organization_admin
                    or membership.has_permission('sales.selling')
                    or membership.has_permission('sales.view')
                ))
            )
            if not can_support:
                raise PermissionDenied('Buyer portal support view requires sales selling permission.')
            buyer = Buyer.objects.for_organization(organization).filter(pk=buyer_id).first()
            if not buyer:
                raise PermissionDenied('Specified buyer was not found in active organization.')
            return buyer
        access = BuyerPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('buyer').first()
        if not access:
            raise PermissionDenied('No active buyer portal profile is linked to this account.')
        return access.buyer

    def _build_portal_data(self, buyer, request):
        organization = buyer.organization
        sales = PropertySale.objects.for_organization(organization).filter(buyer=buyer).select_related(
            'listing__unit', 'listing__project', 'agent',
        ).prefetch_related('payments', 'installments').order_by('-created_at')
        current_sale = next((s for s in sales if s.status not in (PropertySale.Status.CANCELLED,)), sales.first())
        installments = []
        payments = []
        sale_documents = []
        if current_sale:
            installments = Installment.objects.for_organization(organization).filter(sale=current_sale).order_by('sequence')
            payments = SalePayment.objects.for_organization(organization).filter(sale=current_sale).order_by('-paid_on')
            sale_documents = SaleDocument.objects.for_organization(organization).filter(sale=current_sale).order_by('document_type', 'title')

        gateway_listings = SaleListing.objects.for_organization(organization).filter(
            project_id__in=[s.listing.project_id for s in sales if s.listing_id],
            status=SaleListing.Status.AVAILABLE,
        ).select_related('project', 'unit').order_by('project__name', 'unit__code')[:20]
        return {
            'buyer': BuyerSerializer(buyer).data,
            'sales': PropertySaleSerializer(sales, many=True).data,
            'currentSale': PropertySaleSerializer(current_sale).data if current_sale else None,
            'installments': InstallmentSerializer(installments, many=True).data,
            'payments': SalePaymentSerializer(payments, many=True).data,
            'documents': SaleDocumentSerializer(sale_documents, many=True).data,
            'availableUnits': SaleListingSerializer(gateway_listings, many=True).data,
            'kpis': {
                'totalSales': sales.exclude(status=PropertySale.Status.CANCELLED).count(),
                'outstanding': sum((s.agreed_price for s in sales if s.status not in (PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED)), Decimal('0')),
                'verifiedPayments': sum(
                    (p.amount for p in SalePayment.objects.for_organization(organization).filter(sale__buyer=buyer, status=SalePayment.Status.VERIFIED)), Decimal('0'),
                ),
            },
        }

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        buyer_id = request.query_params.get('buyer')
        buyer = self._access(buyer_id=buyer_id)
        return Response(self._build_portal_data(buyer, request))

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def retrieve(self, request, pk=None):
        buyer = self._access(buyer_id=pk)
        return Response(self._build_portal_data(buyer, request))

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='payments/record')
    def record_payment(self, request):
        buyer = self._access()
        sale_id = str(request.data.get('sale') or '').strip()
        installment_id = str(request.data.get('installment') or '').strip()
        amount_val = request.data.get('amount')
        method = str(request.data.get('method') or '').strip()
        external_reference = str(request.data.get('external_reference') or '').strip()
        if not sale_id:
            raise ValidationError({'sale': 'Select a sale.'})
        if not external_reference:
            raise ValidationError({'external_reference': 'Provide the bank/payment reference.'})
        if not method:
            raise ValidationError({'method': 'Select a payment method.'})
        sale = PropertySale.objects.for_organization(buyer.organization).filter(pk=sale_id, buyer=buyer).first()
        if not sale:
            raise ValidationError({'sale': 'This sale does not belong to your buyer account.'})
        try:
            amount = Decimal(str(amount_val))
        except (TypeError, ValueError):
            raise ValidationError({'amount': 'Amount is invalid.'})
        if amount <= 0:
            raise ValidationError({'amount': 'Amount must be greater than zero.'})
        installment = None
        if installment_id:
            installment = Installment.objects.for_organization(buyer.organization).filter(
                pk=installment_id, sale=sale,
            ).first()
            if not installment:
                raise ValidationError({'installment': 'The selected installment does not belong to this sale.'})
        reference = f'SP-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:8].upper()}'
        payment = SalePayment.objects.create(
            organization=buyer.organization, reference=reference, sale=sale,
            installment=installment, paid_on=timezone.localdate(),
            amount=amount, method=method, external_reference=external_reference,
            status=SalePayment.Status.PENDING, rejection_reason='',
        )
        SalesAuditEvent.objects.create(
            organization=buyer.organization, sale=sale, payment=payment,
            event_type='payment_submitted', to_status=payment.status, actor=request.user,
        )
        return Response(SalePaymentSerializer(payment).data, status=201)


class AgentPortalViewSet(ViewSet):
    """Self-service portal for sales agents scoped to their own records."""

    permission_classes = (HasModuleSubscription,)
    required_module = Module.SALES

    def _agent(self):
        if self.request.user.is_superuser:
            return self.request.user
        organization = get_active_organization(self.request)
        membership = get_active_membership(self.request, organization)
        if not membership:
            raise PermissionDenied('No active organization membership is available.')
        from organizations.models import MembershipRole
        is_agent = (
            Buyer.objects.for_organization(organization).filter(assigned_agent=self.request.user).exists()
            or PropertySale.objects.for_organization(organization).filter(agent=self.request.user).exists()
            or SiteVisit.objects.for_organization(organization).filter(introducing_agent=self.request.user).exists()
            or AgentCommission.objects.for_organization(organization).filter(agent=self.request.user).exists()
            or membership.is_organization_admin
            or self.request.user.is_staff
        )
        if not is_agent:
            raise PermissionDenied('This account is not linked to a sales agent profile.')
        return self.request.user

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        agent = self._agent()
        organization = get_active_organization(request)
        is_superuser = request.user.is_superuser
        # Superusers/admin see a portfolio-wide agent summary; regular agents see only their own.
        scope_buyers = Buyer.objects.for_organization(organization) if is_superuser else Buyer.objects.for_organization(organization).filter(assigned_agent=agent)
        scope_sales = PropertySale.objects.for_organization(organization) if is_superuser else PropertySale.objects.for_organization(organization).filter(agent=agent)
        scope_visits = SiteVisit.objects.for_organization(organization)
        scope_commissions = AgentCommission.objects.for_organization(organization)

        leads = scope_buyers.filter(status__in=(Buyer.Status.LEAD, Buyer.Status.QUALIFIED)).order_by('-created_at')[:20]
        pipeline = scope_sales.exclude(status__in=(PropertySale.Status.COMPLETED, PropertySale.Status.CANCELLED)).order_by('-created_at')[:20]
        visits = scope_visits.filter(introducing_agent=agent).select_related('project', 'converted_buyer').order_by('-visited_at')[:20]
        commissions = scope_commissions.filter(agent=agent).select_related('sale__buyer').order_by('-created_at')[:20]

        earned = scope_commissions.filter(agent=agent).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        paid = scope_commissions.filter(agent=agent, status=AgentCommission.Status.PAID).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        pending = earned - paid
        return Response({
            'agent': {
                'id': str(agent.id),
                'username': agent.username,
                'name': agent.get_full_name() or agent.username,
                'email': agent.email,
            },
            'kpis': {
                'openLeads': leads.count(),
                'pipelineDeals': pipeline.count(),
                'siteVisits': visits.count(),
                'earnedCommission': earned,
                'paidCommission': paid,
                'pendingCommission': pending,
            },
            'leads': BuyerSerializer(leads, many=True).data,
            'pipeline': PropertySaleSerializer(pipeline, many=True).data,
            'visits': SiteVisitSerializer(visits, many=True).data,
            'commissions': AgentCommissionSerializer(commissions, many=True).data,
            'availableUnits': SaleListingSerializer(
                SaleListing.objects.for_organization(organization).filter(status=SaleListing.Status.AVAILABLE).select_related('project', 'unit').order_by('project__name', 'unit__code')[:20], many=True,
            ).data,
        })
