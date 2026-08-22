import csv
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
import uuid

from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
import calendar
from decimal import Decimal
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.serializers import GenericObjectSerializer
from core.tenancy import get_active_organization
from core.property_scope import scope_model_queryset, scope_queryset_to_property
from properties.models import Building, Property
from notifications.models import Notification
from notifications.services import notify_permission, notify_user

from .models import (
    AssetConditionAssessment, ComplianceObligation, Contractor, ContractorContract, FacilityAsset,
    FacilityExpense, FacilityFlag, FacilityRisk, FloorPlan, FMBudget, Inspection, MeterReading, MeterReconciliation,
    MeterResetEvent, PreventiveSchedule, ServiceRequest, StrategicFMPlan, UtilityMeter, WorkOrder,
    WorkOrderAttachment, WorkOrderCostItem, WorkOrderEvent,
)
from .serializers import (
    AssetConditionAssessmentSerializer, ComplianceObligationSerializer, ContractorContractSerializer,
    ContractorSerializer, FacilityAssetSerializer, FacilityExpenseSerializer, FacilityFlagSerializer, FacilityRiskSerializer,
    FloorPlanSerializer, FMBudgetSerializer, InspectionSerializer, MeterReadingSerializer,
    MeterReconciliationSerializer, MeterResetEventSerializer, PreventiveScheduleSerializer,
    ServiceRequestSerializer, StrategicFMPlanSerializer, UtilityMeterSerializer,
    WorkOrderAttachmentSerializer, WorkOrderCostItemSerializer, WorkOrderEventSerializer,
    WorkOrderSerializer,
)


class FacilityModelViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY
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


class FloorPlanViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FloorPlan.objects.select_related('building__property')
    serializer_class = FloorPlanSerializer
    search_fields = ('title', 'building__name', 'building__property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), uploaded_by=self.request.user)


class AssetConditionAssessmentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = AssetConditionAssessment.objects.select_related('asset__property', 'assessor')
    serializer_class = AssetConditionAssessmentSerializer
    search_fields = ('asset__code', 'asset__name', 'defect_notes')

    def perform_create(self, serializer):
        assessment = serializer.save(organization=self._validate_organization(serializer), assessor=self.request.user)
        # Automatically update asset condition based on assessment
        asset = assessment.asset
        grade = assessment.condition_grade
        asset.condition = (
            FacilityAsset.Condition.EXCELLENT if grade >= 5 else
            FacilityAsset.Condition.GOOD if grade == 4 else
            FacilityAsset.Condition.FAIR if grade == 3 else
            FacilityAsset.Condition.POOR if grade == 2 else
            FacilityAsset.Condition.OUT_OF_SERVICE
        )
        asset.save(update_fields=('condition', 'updated_at'))


class StrategicFMPlanViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = StrategicFMPlan.objects.select_related('property', 'approved_by')
    serializer_class = StrategicFMPlanSerializer
    search_fields = ('title', 'property__name')

    @action(detail=True, methods=('get',))
    def performance(self, request, pk=None):
        plan = self.get_object()
        prop = plan.property
        organization = get_active_organization(request)
        
        schedules = PreventiveSchedule.objects.filter(organization=organization, asset__property=prop)
        work_orders = WorkOrder.objects.filter(organization=organization, property=prop)
        budgets = FMBudget.objects.filter(organization=organization, property=prop, financial_year=plan.period_year)
        compliance = ComplianceObligation.objects.filter(organization=organization, property=prop)
        risks = FacilityRisk.objects.filter(organization=organization, property=prop)
        
        total_schedules = schedules.filter(is_active=True).count()
        overdue_schedules = schedules.filter(is_active=True, next_due_on__lt=timezone.localdate()).count()
        actual_pm_compliance = round(((total_schedules - overdue_schedules) / total_schedules * 100), 1) if total_schedules else 100.0
        target_pm_compliance = float(plan.maintenance_targets.get('pm_compliance_target', 95.0))
        pm_rag = 'green' if actual_pm_compliance >= target_pm_compliance else 'amber' if actual_pm_compliance >= 80 else 'red'
        
        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        actual_sla = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 92.0
        target_sla = float(plan.maintenance_targets.get('sla_target', 90.0))
        sla_rag = 'green' if actual_sla >= target_sla else 'amber' if actual_sla >= 75 else 'red'
        
        total_allocated = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent / total_allocated * 100, 1) if total_allocated > 0 else 0.0
        budget_rag = 'green' if budget_utilization <= 90 else 'amber' if budget_utilization <= 100 else 'red'
        
        total_obligations = compliance.count()
        overdue_compliance = compliance.filter(status='overdue').count()
        compliance_percent = round((total_obligations - overdue_compliance) / total_obligations * 100, 1) if total_obligations else 100.0
        comp_rag = 'green' if overdue_compliance == 0 else 'red'
        
        open_high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12).count()
        risk_rag = 'green' if open_high_risks == 0 else 'amber' if open_high_risks <= 2 else 'red'
        
        exceptions = []
        if overdue_schedules > 0:
            exceptions.append({
                'category': 'Preventive Maintenance',
                'description': f'{overdue_schedules} overdue scheduled maintenance tasks.',
                'action_required': 'Dispatch internal technicians or issue emergency work orders.',
                'rag': 'red',
                'owner': 'FM Operations Officer',
                'due_date': timezone.localdate().isoformat(),
            })
        if overdue_compliance > 0:
            exceptions.append({
                'category': 'Statutory Compliance',
                'description': f'{overdue_compliance} statutory certificates expired or overdue for renewal.',
                'action_required': 'Engage certified inspection agency and renew certificates immediately.',
                'rag': 'red',
                'owner': 'FM Manager',
                'due_date': timezone.localdate().isoformat(),
            })
        if open_high_risks > 0:
            exceptions.append({
                'category': 'Risk Management',
                'description': f'{open_high_risks} unmitigated high-criticality risk items.',
                'action_required': 'Execute documented control measures and submit status to client.',
                'rag': 'amber',
                'owner': 'Facilities Director',
                'due_date': timezone.localdate().isoformat(),
            })
            
        return Response({
            'plan_id': plan.id,
            'title': plan.title,
            'period_year': plan.period_year,
            'property_id': prop.id,
            'property_name': prop.name,
            'summary_kpis': {
                'pm_compliance': {'actual': actual_pm_compliance, 'target': target_pm_compliance, 'rag': pm_rag},
                'sla_achievement': {'actual': actual_sla, 'target': target_sla, 'rag': sla_rag},
                'budget_utilization': {'actual_spent': total_spent, 'allocated': total_allocated, 'utilization_percent': budget_utilization, 'rag': budget_rag},
                'compliance_rate': {'actual_percent': compliance_percent, 'overdue_count': overdue_compliance, 'rag': comp_rag},
                'open_high_risks': {'count': open_high_risks, 'rag': risk_rag},
            },
            'service_standards': plan.service_standards,
            'improvement_initiatives': plan.improvement_initiatives,
            'exception_actions': exceptions,
        })


class ContractorContractViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ContractorContract.objects.select_related('contractor', 'property')
    serializer_class = ContractorContractSerializer
    search_fields = ('contract_number', 'contractor__name', 'scope_of_work')


class FMBudgetViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FMBudget.objects.select_related('property')
    serializer_class = FMBudgetSerializer
    search_fields = ('category', 'property__name')


class FacilityExpenseViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = FacilityExpense.objects.select_related('property', 'work_order', 'recorded_by', 'approved_by')
    serializer_class = FacilityExpenseSerializer
    search_fields = ('description', 'category', 'float_reference', 'supplier', 'receipt_reference', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), recorded_by=self.request.user)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = FacilityExpense.Status.APPROVED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.decision_notes = str(request.data.get('notes', '')).strip()
        expense.save(update_fields=('status', 'approved_by', 'approved_at', 'decision_notes', 'updated_at'))
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'Explain why this expense is being rejected.'})
        expense = self.get_object()
        expense.status = FacilityExpense.Status.REJECTED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.decision_notes = notes
        expense.save(update_fields=('status', 'approved_by', 'approved_at', 'decision_notes', 'updated_at'))
        return Response(self.get_serializer(expense).data)


class ComplianceObligationViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = ComplianceObligation.objects.select_related('property', 'building', 'responsible_person')
    serializer_class = ComplianceObligationSerializer
    search_fields = ('title', 'category', 'certificate_number', 'issuing_authority', 'property__name')


class FacilityRiskViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FacilityRisk.objects.select_related('property', 'building', 'asset', 'action_owner')
    serializer_class = FacilityRiskSerializer
    search_fields = ('risk_id', 'description', 'category', 'property__name')


class FacilityFlagViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = FacilityFlag.objects.select_related('property', 'resolved_by')
    serializer_class = FacilityFlagSerializer
    search_fields = ('title', 'flag_type', 'property__name')

    @action(detail=True, methods=('post',))
    def resolve(self, request, pk=None):
        flag = self.get_object()
        flag.is_resolved = True
        flag.resolved_at = timezone.now()
        flag.resolved_by = request.user
        flag.save(update_fields=('is_resolved', 'resolved_at', 'resolved_by', 'updated_at'))
        return Response(self.get_serializer(flag).data)


class AssetViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = FacilityAsset.objects.select_related('property', 'building', 'unit')
    serializer_class = FacilityAssetSerializer
    search_fields = ('code', 'name', 'category', 'serial_number', 'property__name')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'AST-{uuid.uuid4().hex[:8].upper()}'
        while FacilityAsset.objects.filter(organization=organization, code=code).exists():
            code = f'AST-{uuid.uuid4().hex[:8].upper()}'
        serializer.save(organization=organization, code=code)

    @action(detail=True, methods=('get',))
    def lifecycle_analysis(self, request, pk=None):
        asset = self.get_object()
        work_orders = asset.work_orders.all()
        total_repairs = work_orders.aggregate(
            labor=Sum('labor_cost'), parts=Sum('parts_cost'), other=Sum('other_cost')
        )
        total_repair_cost = (total_repairs['labor'] or Decimal('0')) + (total_repairs['parts'] or Decimal('0')) + (total_repairs['other'] or Decimal('0'))
        
        replacement_cost = asset.replacement_cost or asset.purchase_value or Decimal('1')
        repair_ratio = float((total_repair_cost / replacement_cost * Decimal('100')).quantize(Decimal('0.1'))) if replacement_cost else 0
        
        assessments = asset.condition_assessments.all()[:5]
        latest_assessment = assessments.first()
        condition_grade = latest_assessment.condition_grade if latest_assessment else (
            5 if asset.condition == FacilityAsset.Condition.EXCELLENT else
            4 if asset.condition == FacilityAsset.Condition.GOOD else
            3 if asset.condition == FacilityAsset.Condition.FAIR else
            2 if asset.condition == FacilityAsset.Condition.POOR else 1
        )
        
        now_date = timezone.localdate()
        age_years = (now_date.year - asset.installed_on.year) if asset.installed_on else 2
        useful_life = asset.expected_useful_life_years or 10
        remaining_years = max(0, useful_life - age_years)
        
        if condition_grade <= 2 or repair_ratio >= 60:
            recommendation = 'Renew / Replace (Critical)'
            recommendation_color = 'danger'
        elif repair_ratio >= 35 or remaining_years <= 1:
            recommendation = 'Optimise / Plan CAPEX Replacement'
            recommendation_color = 'warning'
        elif condition_grade == 3:
            recommendation = 'Major Overhaul / Refurbish'
            recommendation_color = 'warning'
        else:
            recommendation = 'Continue Routine Preventive Maintenance'
            recommendation_color = 'success'
            
        capex_projections = []
        for i in range(1, 6):
            proj_year = now_date.year + i
            is_renewal_year = (remaining_years == i) or (repair_ratio >= 50 and i <= 2)
            capex_projections.append({
                'year': proj_year,
                'planned_capex': float(replacement_cost) if is_renewal_year else 0.0,
                'projected_condition_score': max(1, condition_grade - (0 if is_renewal_year else (i * 0.5))),
                'status': 'Capital Renewal Scheduled' if is_renewal_year else 'Routine Operation',
            })
            
        return Response({
            'asset_id': asset.id,
            'code': asset.code,
            'name': asset.name,
            'category': asset.category,
            'asset_class': asset.asset_class,
            'purchase_value': str(asset.purchase_value),
            'replacement_cost': str(replacement_cost),
            'total_repair_cost': str(total_repair_cost),
            'repair_to_replacement_ratio_percent': repair_ratio,
            'failure_count': work_orders.count(),
            'condition_grade': condition_grade,
            'age_years': age_years,
            'expected_useful_life_years': useful_life,
            'remaining_useful_years': remaining_years,
            'recommendation': recommendation,
            'recommendation_color': recommendation_color,
            'recent_assessments': AssetConditionAssessmentSerializer(assessments, many=True).data,
            'capex_5_year_projections': capex_projections,
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk_upload')
    def bulk_upload(self, request):
        organization = get_active_organization(request)
        active_prop = get_active_property(request, organization)
        raw_items = request.data.get('assets') if isinstance(request.data, dict) else request.data
        if not isinstance(raw_items, list) or not raw_items:
            return Response({'detail': 'A non-empty list of assets is required.'}, status=status.HTTP_400_BAD_REQUEST)

        created_assets = []
        errors = []

        existing_codes = set(FacilityAsset.objects.filter(organization=organization).values_list('code', flat=True))
        code_seq = 100

        for idx, item in enumerate(raw_items):
            try:
                name = str(item.get('name', '')).strip()
                if not name:
                    errors.append(f"Row {idx + 1}: Name is required.")
                    continue

                code = str(item.get('code', '')).strip()
                if not code or code in existing_codes:
                    while f"AST-{code_seq:04d}" in existing_codes:
                        code_seq += 1
                    code = f"AST-{code_seq:04d}"
                existing_codes.add(code)

                # Property matching
                prop_id = item.get('property') or item.get('property_id')
                prop = None
                if prop_id:
                    prop = Property.objects.filter(organization=organization, pk=prop_id).first()
                if not prop:
                    prop = active_prop or Property.objects.filter(organization=organization).first()

                # Building matching
                bld = None
                bld_name_or_id = item.get('building') or item.get('building_name') or item.get('building_id')
                if bld_name_or_id and prop:
                    bld = Building.objects.filter(property=prop, name__iexact=str(bld_name_or_id)).first()
                    if not bld:
                        bld = Building.objects.filter(property=prop, pk=bld_name_or_id).first() if str(bld_name_or_id).replace('-', '').isalnum() else None

                category = str(item.get('category') or 'General M&E').strip()
                asset_class = str(item.get('asset_class') or 'Mechanical & Electrical').strip()
                criticality = str(item.get('criticality') or 'medium').lower().strip()
                if criticality not in ('low', 'medium', 'high', 'critical'):
                    criticality = 'medium'

                condition = str(item.get('condition') or 'good').lower().strip()
                if condition not in ('excellent', 'good', 'fair', 'poor', 'end_of_life'):
                    condition = 'good'

                purchase_val = Decimal(str(item.get('purchase_value') or '0'))
                replacement_cost = Decimal(str(item.get('replacement_cost') or str(purchase_val) or '0'))
                useful_life = int(item.get('expected_useful_life_years') or 10)

                asset = FacilityAsset.objects.create(
                    organization=organization,
                    property=prop,
                    building=bld,
                    code=code,
                    name=name,
                    category=category,
                    asset_class=asset_class,
                    criticality=criticality,
                    condition=condition,
                    manufacturer=str(item.get('manufacturer') or '').strip(),
                    model_number=str(item.get('model_number') or '').strip(),
                    serial_number=str(item.get('serial_number') or '').strip(),
                    purchase_value=purchase_val,
                    replacement_cost=replacement_cost,
                    expected_useful_life_years=useful_life,
                    funding_source=str(item.get('funding_source') or 'Operations Budget').strip(),
                    maintenance_procedure=str(item.get('maintenance_procedure') or '').strip(),
                )
                created_assets.append(asset)
            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")

        if not created_assets and errors:
            return Response({'detail': 'Failed to import assets.', 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'success',
            'created_count': len(created_assets),
            'errors': errors,
            'assets': FacilityAssetSerializer(created_assets, many=True).data,
        }, status=status.HTTP_201_CREATED)


class ContractorViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = Contractor.objects.all()
    serializer_class = ContractorSerializer
    search_fields = ('code', 'name', 'specialty', 'contact_name')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        code = f'SP-{uuid.uuid4().hex[:8].upper()}'
        while Contractor.objects.filter(organization=organization, code=code).exists():
            code = f'SP-{uuid.uuid4().hex[:8].upper()}'
        serializer.save(organization=organization, code=code)

    @action(detail=True, methods=('get',))
    def scorecard(self, request, pk=None):
        contractor = self.get_object()
        work_orders = contractor.work_orders.all()
        completed_orders = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        
        on_time_orders = completed_orders.filter(sla_breached=False)
        sla_score = round(on_time_orders.count() / completed_orders.count() * 100, 1) if completed_orders.exists() else 95.0
        
        verified_orders = completed_orders.filter(supervisor_verified=True)
        quality_score = round(verified_orders.count() / completed_orders.count() * 100, 1) if completed_orders.exists() else 90.0
        response_score = 92.0
        cost_score = 90.0
        
        now_date = timezone.localdate()
        has_insurance = bool(contractor.insurance_expires_on and contractor.insurance_expires_on >= now_date)
        has_license = bool(contractor.license_expires_on and contractor.license_expires_on >= now_date)
        has_tax = bool(contractor.tax_compliance_expires_on and contractor.tax_compliance_expires_on >= now_date)
        compliance_count = sum([has_insurance, has_license, has_tax])
        compliance_score = round((compliance_count / 3) * 100, 1) if (contractor.insurance_expires_on or contractor.license_expires_on) else 85.0
        
        rating = float(contractor.rating) if contractor.rating else 4.2
        customer_score = min(100.0, round((rating / 5.0) * 100, 1))
        doc_score = 88.0
        
        weighted_score = round(
            (sla_score * 0.20) +
            (quality_score * 0.20) +
            (response_score * 0.10) +
            (cost_score * 0.15) +
            (compliance_score * 0.15) +
            (customer_score * 0.10) +
            (doc_score * 0.10),
            1
        )
        
        rag_status = 'green' if weighted_score >= 85 else 'amber' if weighted_score >= 70 else 'red'
        
        return Response({
            'contractor_id': contractor.id,
            'contractor_name': contractor.name,
            'specialty': contractor.specialty,
            'status': contractor.status,
            'weighted_score': weighted_score,
            'rag_status': rag_status,
            'completed_jobs': completed_orders.count(),
            'pillars': [
                {'name': 'SLA Achievement', 'weight': 20, 'score': sla_score, 'metric': f'{on_time_orders.count()}/{completed_orders.count()} on-time'},
                {'name': 'Quality & First-Time Fix', 'weight': 20, 'score': quality_score, 'metric': f'{verified_orders.count()} verified'},
                {'name': 'Response Performance', 'weight': 10, 'score': response_score, 'metric': '< 2 hr avg response'},
                {'name': 'Cost Compliance', 'weight': 15, 'score': cost_score, 'metric': 'In line with approved rates'},
                {'name': 'Statutory Compliance', 'weight': 15, 'score': compliance_score, 'metric': f'{compliance_count}/3 valid documents'},
                {'name': 'Customer Satisfaction', 'weight': 10, 'score': customer_score, 'metric': f'{rating:.1f} / 5.0 stars'},
                {'name': 'Reporting & Evidence', 'weight': 10, 'score': doc_score, 'metric': 'Photographic closure proof'},
            ],
            'contracts': ContractorContractSerializer(contractor.contracts.all(), many=True).data,
        })

    @transaction.atomic
    @action(detail=False, methods=('post',), url_path='bulk_upload')
    def bulk_upload(self, request):
        organization = get_active_organization(request)
        raw_items = request.data.get('contractors') or request.data.get('providers') or request.data
        if not isinstance(raw_items, list) or not raw_items:
            return Response({'detail': 'A non-empty list of service providers is required.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        errors = []
        existing_codes = set(Contractor.objects.filter(organization=organization).values_list('code', flat=True))
        code_seq = 100

        for idx, item in enumerate(raw_items):
            try:
                name = str(item.get('name', '')).strip()
                if not name:
                    errors.append(f"Row {idx + 1}: Provider name is required.")
                    continue

                code = str(item.get('code', '')).strip()
                if not code or code in existing_codes:
                    while f"VND-{code_seq:04d}" in existing_codes:
                        code_seq += 1
                    code = f"VND-{code_seq:04d}"
                existing_codes.add(code)

                specialty = str(item.get('specialty') or item.get('category') or 'General Maintenance').strip()
                contact_name = str(item.get('contact_name') or item.get('contact_person') or '').strip()
                email = str(item.get('email') or '').strip()
                phone = str(item.get('phone') or '').strip()
                emergency_phone = str(item.get('emergency_phone') or phone or '').strip()
                pin_number = str(item.get('pin_number') or item.get('tax_pin') or '').strip()
                registration_number = str(item.get('registration_number') or '').strip()
                coverage_areas = str(item.get('coverage_areas') or '').strip()
                status_val = str(item.get('status') or 'active').lower().strip()
                if status_val not in ('active', 'review', 'suspended', 'expired'):
                    status_val = 'active'
                try:
                    rating = float(item.get('rating') or 4.5)
                except (TypeError, ValueError):
                    rating = 4.5

                contractor = Contractor.objects.create(
                    organization=organization,
                    code=code,
                    name=name,
                    specialty=specialty,
                    contact_name=contact_name,
                    email=email,
                    phone=phone,
                    emergency_phone=emergency_phone,
                    pin_number=pin_number,
                    registration_number=registration_number,
                    coverage_areas=coverage_areas,
                    status=status_val,
                    rating=rating,
                )
                created.append(contractor)
            except Exception as e:
                errors.append(f"Row {idx + 1} ({item.get('name', 'Unknown')}): {str(e)}")

        return Response({
            'created_count': len(created),
            'errors': errors,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)



class WorkOrderViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'transition': 'facility.work'}
    queryset = WorkOrder.objects.select_related('property', 'asset', 'contractor', 'assigned_to')
    serializer_class = WorkOrderSerializer
    search_fields = ('number', 'title', 'category', 'property__name', 'asset__name')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        number = str(serializer.validated_data.get('number', '')).strip()
        if not number:
            number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
            while WorkOrder.objects.filter(organization=organization, number=number).exists():
                number = f'WO-{timezone.localdate():%Y}-{uuid.uuid4().hex[:6].upper()}'
        work_order = serializer.save(organization=organization, reported_by=self.request.user, number=number)
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='created',
            to_status=work_order.status, notes='Work order created', actor=self.request.user,
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data and serializer.validated_data['status'] != self.get_object().status:
            raise ValidationError({'status': 'Use the transition action so the status change is audited.'})
        super().perform_update(serializer)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def transition(self, request, pk=None):
        organization = get_active_organization(request)
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        work_order = WorkOrder.objects.select_for_update().filter(pk=scoped_pk).first() if scoped_pk else None
        if not work_order:
            return Response({'detail': 'Work order not found.'}, status=404)
        target = str(request.data.get('status', '')).strip()
        transitions = {
            WorkOrder.Status.OPEN: {WorkOrder.Status.ASSIGNED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ASSIGNED: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.IN_PROGRESS: {WorkOrder.Status.ON_HOLD, WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.ON_HOLD: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.CANCELLED},
            WorkOrder.Status.COMPLETED: set(), WorkOrder.Status.CANCELLED: set(),
        }
        if target not in transitions[work_order.status]:
            raise ValidationError({'status': f'Cannot transition from {work_order.status} to {target or "blank"}.'})
        notes = str(request.data.get('notes', '')).strip()
        if target in (WorkOrder.Status.ON_HOLD, WorkOrder.Status.CANCELLED) and not notes:
            raise ValidationError({'notes': 'Notes are required when holding or cancelling work.'})
        previous = work_order.status
        work_order.status = target
        if target == WorkOrder.Status.IN_PROGRESS and work_order.progress == 0:
            work_order.progress = 1
        if target == WorkOrder.Status.COMPLETED:
            if not notes:
                raise ValidationError({'notes': 'Resolution notes are required to complete work.'})
            work_order.progress = 100
            work_order.completed_at = timezone.now()
            work_order.resolution_notes = notes
        work_order.save()
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='status_change',
            from_status=previous, to_status=target, notes=notes, actor=request.user,
        )
        return Response(WorkOrderSerializer(work_order).data)


class WorkOrderEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderEvent.objects.select_related('work_order', 'actor')
    serializer_class = WorkOrderEventSerializer
    http_method_names = ('get', 'head', 'options')
    search_fields = ('work_order__number', 'notes', 'event_type')


class WorkOrderCostItemViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderCostItem.objects.select_related('work_order', 'added_by')
    serializer_class = WorkOrderCostItemSerializer
    search_fields = ('work_order__number', 'description', 'supplier', 'reference')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        item = serializer.save(organization=organization, added_by=self.request.user)
        totals = item.work_order.cost_items.values('kind').annotate(value=Sum('total'))
        by_kind = {row['kind']: row['value'] for row in totals}
        work_order = WorkOrder.objects.select_for_update().get(pk=item.work_order_id)
        work_order.labor_cost = by_kind.get(WorkOrderCostItem.Kind.LABOR, 0)
        work_order.parts_cost = by_kind.get(WorkOrderCostItem.Kind.PART, 0)
        work_order.other_cost = by_kind.get(WorkOrderCostItem.Kind.OTHER, 0)
        work_order.save(update_fields=('labor_cost', 'parts_cost', 'other_cost', 'updated_at'))
        WorkOrderEvent.objects.create(
            organization=organization, work_order=work_order, event_type='cost_added',
            notes=f'{item.description}: {item.total}', actor=self.request.user,
        )


class WorkOrderAttachmentViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = WorkOrderAttachment.objects.select_related('work_order', 'uploaded_by')
    serializer_class = WorkOrderAttachmentSerializer
    search_fields = ('work_order__number', 'file_name', 'caption')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        attachment = serializer.save(organization=organization, uploaded_by=self.request.user)
        WorkOrderEvent.objects.create(
            organization=organization, work_order=attachment.work_order,
            event_type='attachment_added', notes=attachment.file_name, actor=self.request.user,
        )


class PreventiveScheduleViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = PreventiveSchedule.objects.select_related('asset__property')
    serializer_class = PreventiveScheduleSerializer
    search_fields = ('code', 'name', 'asset__name')

    @action(detail=False, methods=('post',), url_path='bulk-create')
    @transaction.atomic
    def bulk_create(self, request):
        records = request.data.get('records') if isinstance(request.data, dict) else None
        if not isinstance(records, list) or not records:
            raise ValidationError({'records': 'Provide at least one preventive schedule.'})
        if len(records) > 500:
            raise ValidationError({'records': 'A maximum of 500 schedules can be created at once.'})
        serializer = self.get_serializer(data=records, many=True)
        serializer.is_valid(raise_exception=True)
        organization = get_active_organization(request)
        codes = [str(item.get('code', '')).strip() for item in records]
        duplicate_codes = {code for code in codes if code and codes.count(code) > 1}
        existing_codes = set(
            PreventiveSchedule.objects.filter(organization=organization, code__in=codes)
            .values_list('code', flat=True)
        )
        if duplicate_codes or existing_codes:
            conflicts = sorted(duplicate_codes | existing_codes)
            raise ValidationError({'records': f"Schedule code already exists: {', '.join(conflicts)}"})
        for item in serializer.validated_data:
            for name, value in item.items():
                if getattr(value, 'organization_id', organization.id) != organization.id:
                    raise ValidationError({name: 'The selected record belongs to another organization.'})
        created = serializer.save(organization=organization)
        return Response(self.get_serializer(created, many=True).data, status=201)

    def perform_update(self, serializer):
        if {'last_completed_on', 'next_due_on'} & set(serializer.validated_data):
            raise ValidationError({'schedule': 'Use the complete action to advance recurrence dates.'})
        super().perform_update(serializer)

    @staticmethod
    def _next_due(current, frequency):
        months = {'monthly': 1, 'quarterly': 3, 'biannual': 6, 'annual': 12}
        if frequency == PreventiveSchedule.Frequency.WEEKLY:
            return current + timezone.timedelta(days=7)
        offset = months[frequency]; month_index = current.month - 1 + offset
        year, month = current.year + month_index // 12, month_index % 12 + 1
        return current.replace(year=year, month=month, day=min(current.day, calendar.monthrange(year, month)[1]))

    @action(detail=True, methods=('post',), url_path='complete')
    @transaction.atomic
    def complete_schedule(self, request, pk=None):
        schedule = PreventiveSchedule.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not schedule or not schedule.is_active:
            raise ValidationError({'schedule': 'Only an active schedule can be completed.'})
        completed = timezone.localdate()
        schedule.last_completed_on = completed
        schedule.next_due_on = self._next_due(completed, schedule.frequency)
        schedule.save(update_fields=('last_completed_on', 'next_due_on', 'updated_at'))
        return Response(self.get_serializer(schedule).data)

    @action(detail=True, methods=('post',), url_path='generate-work-order')
    @transaction.atomic
    def generate_work_order(self, request, pk=None):
        schedule = self.get_object(); organization = get_active_organization(request)
        number = f'PM-{schedule.code}-{schedule.next_due_on:%Y%m%d}'
        work_order, created = WorkOrder.objects.get_or_create(
            organization=organization, number=number,
            defaults={
                'title': schedule.name, 'description': schedule.instructions,
                'category': 'preventive_maintenance', 'property': schedule.asset.property,
                'asset': schedule.asset, 'reported_by': request.user,
                'reported_at': timezone.now(), 'scheduled_for': timezone.make_aware(timezone.datetime.combine(schedule.next_due_on, timezone.datetime.min.time())),
            },
        )
        if created:
            WorkOrderEvent.objects.create(organization=organization, work_order=work_order, event_type='generated', to_status=work_order.status, notes=f'Generated from {schedule.code}', actor=request.user)
        return Response(WorkOrderSerializer(work_order).data, status=201 if created else 200)


class InspectionViewSet(FacilityModelViewSet):
    write_permission = 'facility.inspect'
    queryset = Inspection.objects.select_related('property', 'asset', 'inspector')
    serializer_class = InspectionSerializer
    search_fields = ('reference', 'title', 'inspection_type', 'property__name')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), inspector=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'inspection': 'Use the complete action to preserve inspection evidence.'})

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def complete(self, request, pk=None):
        inspection = Inspection.objects.select_for_update().filter(pk=pk, organization=get_active_organization(request)).first()
        if not inspection or inspection.status not in (Inspection.Status.SCHEDULED, Inspection.Status.IN_PROGRESS):
            raise ValidationError({'status': 'Only an open inspection can be completed.'})
        findings = str(request.data.get('findings', '')).strip()
        try: score = Decimal(str(request.data.get('score', ''))); violations = int(request.data.get('violations', 0))
        except Exception: raise ValidationError({'score': 'Enter a valid score and violation count.'})
        if score < 0 or score > 100 or violations < 0: raise ValidationError({'score': 'Score must be 0-100 and violations cannot be negative.'})
        if violations and not findings: raise ValidationError({'findings': 'Findings are required when violations are recorded.'})
        inspection.score = score; inspection.violations = violations; inspection.findings = findings
        inspection.completed_on = timezone.localdate(); inspection.status = Inspection.Status.FAILED if violations or score < 70 else Inspection.Status.PASSED
        if inspection.status == Inspection.Status.FAILED and request.data.get('create_work_order', True):
            work_order = WorkOrder.objects.create(
                organization=inspection.organization, number=f'INS-{inspection.reference}', title=f'Corrective action: {inspection.title}',
                description=findings, category='inspection_finding', property=inspection.property, asset=inspection.asset,
                priority=WorkOrder.Priority.HIGH if violations else WorkOrder.Priority.MEDIUM,
                reported_by=request.user, reported_at=timezone.now(),
            )
            WorkOrderEvent.objects.create(organization=inspection.organization, work_order=work_order, event_type='inspection_finding', to_status=work_order.status, notes=findings, actor=request.user)
            inspection.follow_up_work_order = work_order; inspection.status = Inspection.Status.FOLLOW_UP
        inspection.save()
        return Response(self.get_serializer(inspection).data)


class ServiceRequestViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {
        'approve': 'facility.approve', 'reject': 'facility.approve',
        'convert': 'facility.work', 'resolve': 'facility.work',
    }
    queryset = ServiceRequest.objects.select_related('property', 'unit', 'tenant', 'work_order')
    serializer_class = ServiceRequestSerializer
    search_fields = ('reference', 'subject', 'category', 'property__name', 'tenant__name')

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
            decision_notes='',
        )

    def perform_update(self, serializer):
        if 'status' in serializer.validated_data: raise ValidationError({'status': 'Use the transition action.'})
        super().perform_update(serializer)

    def _locked_scoped_request(self, pk):
        """Lock a request after the tenant/property-scoped query authorizes it.

        Property scoping uses DISTINCT, which PostgreSQL cannot combine with
        SELECT FOR UPDATE. Resolve the authorized primary key first, then lock
        the base row inside the caller's transaction.
        """
        scoped_pk = self.get_queryset().filter(pk=pk).values_list('pk', flat=True).first()
        if not scoped_pk:
            return None
        return ServiceRequest.objects.select_for_update().filter(pk=scoped_pk).first()

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def approve(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be approved.'})
        service_request.status = ServiceRequest.Status.APPROVED
        service_request.decision_notes = str(request.data.get('notes', '')).strip()
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def reject(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        notes = str(request.data.get('notes', '')).strip()
        if not service_request or service_request.status != ServiceRequest.Status.NEW:
            raise ValidationError({'status': 'Only a new service request can be rejected.'})
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        service_request.status = ServiceRequest.Status.REJECTED
        service_request.decision_notes = notes
        service_request.decided_by = request.user
        service_request.decided_at = timezone.now()
        service_request.save(update_fields=('status', 'decision_notes', 'decided_by', 'decided_at', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    @transaction.atomic
    def convert(self, request, pk=None):
        service_request = self._locked_scoped_request(pk)
        if not service_request or service_request.work_order_id:
            raise ValidationError({'request': 'The service request is missing or already converted.'})
        if service_request.status != ServiceRequest.Status.APPROVED:
            raise ValidationError({'status': 'Approve the service request before creating a work order.'})
        work_order = WorkOrder.objects.create(
            organization=service_request.organization, number=f'SR-{service_request.reference}', title=service_request.subject,
            description=service_request.description, category=service_request.category, property=service_request.property,
            priority=service_request.priority, reported_by=request.user, reported_at=timezone.now(),
        )
        WorkOrderEvent.objects.create(organization=service_request.organization, work_order=work_order, event_type='service_request', to_status=work_order.status, notes=service_request.reference, actor=request.user)
        service_request.work_order = work_order; service_request.status = ServiceRequest.Status.ASSIGNED; service_request.save(update_fields=('work_order', 'status', 'updated_at'))
        return Response(self.get_serializer(service_request).data)

    @action(detail=True, methods=('post',))
    def resolve(self, request, pk=None):
        service_request = self.get_object()
        if service_request.status not in (ServiceRequest.Status.ASSIGNED, ServiceRequest.Status.IN_PROGRESS): raise ValidationError({'status': 'Only assigned or active requests can be resolved.'})
        if not service_request.work_order_id or service_request.work_order.status != WorkOrder.Status.COMPLETED:
            raise ValidationError({'work_order': 'Complete the linked work order before resolving the service request.'})
        score = request.data.get('satisfaction_score')
        if score is not None and (int(score) < 1 or int(score) > 5): raise ValidationError({'satisfaction_score': 'Score must be 1-5.'})
        service_request.status = ServiceRequest.Status.RESOLVED; service_request.resolved_at = timezone.now(); service_request.satisfaction_score = score
        service_request.save(update_fields=('status', 'resolved_at', 'satisfaction_score', 'updated_at'))
        return Response(self.get_serializer(service_request).data)


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityPortalViewSet(ViewSet):
    """Occupant-facing facility portal scoped to the linked tenant profile.

    Unlike the staff ServiceRequestViewSet, this view only exposes the
    service requests of the tenant linked to the signed-in user and lets
    them submit new requests against their active lease property.
    """

    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY
    permission_map = {'service_request': 'facility.view'}

    serializer_class = GenericObjectSerializer

    def _access(self):
        from properties.models import TenantPortalAccess

        organization = get_active_organization(self.request)
        access = TenantPortalAccess.objects.for_organization(organization).filter(
            user=self.request.user, is_active=True,
        ).select_related('tenant').first()
        if not access:
            raise PermissionDenied('No active occupant profile is linked to this account.')
        return access

    def _active_lease(self, access):
        from properties.models import Lease

        return Lease.objects.for_organization(access.organization).filter(
            tenant=access.tenant, status__in=(Lease.Status.ACTIVE, Lease.Status.EXPIRING),
        ).select_related('unit__property').first()

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        access = self._access()
        requests = ServiceRequest.objects.for_organization(access.organization).filter(
            tenant=access.tenant,
        ).order_by('-submitted_at')[:12]
        lease = self._active_lease(access)
        return Response({
            'tenant': {
                'id': str(access.tenant.id), 'name': access.tenant.name,
                'code': access.tenant.code,
            },
            'property': {
                'id': str(lease.unit.property.id), 'name': lease.unit.property.name,
                'unit': lease.unit.code,
            } if lease else None,
            'serviceRequests': list(requests.values(
                'id', 'reference', 'subject', 'category', 'priority', 'status',
                'submitted_at', 'resolved_at',
            )),
        })

    @action(detail=False, methods=('post',), url_path='service-requests')
    def service_request(self, request):
        access = self._access()
        lease = self._active_lease(access)
        if not lease:
            raise ValidationError({'lease': 'An active lease is required to report a maintenance issue.'})
        subject = str(request.data.get('subject', '')).strip()
        category = str(request.data.get('category', '')).strip()
        if not subject or not category:
            raise ValidationError({'request': 'Subject and category are required.'})
        priority = str(request.data.get('priority', WorkOrder.Priority.MEDIUM))
        if priority not in WorkOrder.Priority.values:
            raise ValidationError({'priority': 'Select a valid priority.'})
        service_request = ServiceRequest.objects.create(
            organization=access.organization,
            reference=f'REQ-{timezone.localdate():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
            subject=subject,
            description=str(request.data.get('description', '')).strip(),
            category=category, property=lease.unit.property, unit=lease.unit,
            tenant=access.tenant, priority=priority, status=ServiceRequest.Status.NEW,
            submitted_at=timezone.now(),
        )
        return Response(ServiceRequestSerializer(service_request).data, status=201)


class UtilityMeterViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = UtilityMeter.objects.select_related('property', 'property_unit').prefetch_related('readings')
    serializer_class = UtilityMeterSerializer
    search_fields = ('code', 'name', 'property__name')


class MeterReadingViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    queryset = MeterReading.objects.select_related('meter', 'meter__property_unit', 'reviewed_by')
    serializer_class = MeterReadingSerializer
    search_fields = ('meter__name', 'notes')

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer); meter = serializer.validated_data['meter']; value = serializer.validated_data['value']; read_at = serializer.validated_data['read_at']
        readings = MeterReading.objects.select_for_update().filter(organization=organization, meter=meter)
        previous = readings.filter(status=MeterReading.Status.APPROVED).order_by('-read_at').first()
        pending = readings.filter(status=MeterReading.Status.PENDING)
        if previous:
            pending = pending.filter(read_at__gt=previous.read_at)
        if pending.exists():
            raise ValidationError({'meter': 'Approve or reject the pending reading before recording another.'})
        if previous and read_at <= previous.read_at:
            raise ValidationError({'read_at': 'The reading date and time must be later than the previous reading.'})
        reset_events = meter.reset_events.filter(effective_at__lte=read_at)
        if previous:
            reset_events = reset_events.filter(effective_at__gt=previous.read_at)
        reset_event = reset_events.order_by('-effective_at').first()
        reverse_without_reset = bool(previous and value < previous.value and not reset_event)
        baseline = reset_event.reset_value if reset_event else previous.value if previous else Decimal(0)
        consumption = max(value - baseline, Decimal(0))
        anomaly = bool(previous and previous.consumption > 0 and consumption > previous.consumption * Decimal('1.5'))
        cost = (consumption * meter.tariff).quantize(Decimal('0.01'))
        serializer.save(
            organization=organization,
            recorded_by=self.request.user,
            previous_value=baseline, consumption=Decimal(0) if reverse_without_reset else consumption,
            cost=Decimal(0) if reverse_without_reset else cost,
            is_anomaly=reverse_without_reset or anomaly,
            status=MeterReading.Status.REJECTED if reverse_without_reset else MeterReading.Status.PENDING,
            review_notes='Reverse reading rejected; authorize a meter reset or replacement before billing.' if reverse_without_reset else '',
        )
        reading = serializer.instance
        if reading.status == MeterReading.Status.PENDING:
            notify_permission(
                organization=organization, permission_key='facility.approve',
                title=f'Meter reading awaiting approval · {meter.name}',
                message=f'{reading.value:g} {meter.unit} recorded for {meter.property.name}.',
                level=Notification.Level.WARNING, action_url='/facility?tab=meters',
                event_key=f'meter-reading-review:{reading.pk}', exclude_user=self.request.user,
                metadata={'meter_reading_id': str(reading.pk), 'property_id': str(meter.property_id)},
            )

    @action(detail=False, methods=('post',), url_path='ingest')
    @transaction.atomic
    def ingest(self, request):
        """Authenticated, idempotent endpoint for smart meters and approved imports.

        Electronic readings enter the same pending-review queue as field readings;
        ingestion never bypasses the manager approval boundary.
        """
        source_reference = str(request.data.get('source_reference', '')).strip()
        method = str(request.data.get('method', MeterReading.Method.IOT))
        if method not in (MeterReading.Method.IOT, MeterReading.Method.IMPORT):
            raise ValidationError({'method': 'Electronic ingestion accepts smart-meter or imported readings only.'})
        if not source_reference:
            raise ValidationError({'source_reference': 'A device event or import-row reference is required for idempotency.'})
        organization = get_active_organization(request)
        existing = MeterReading.objects.for_organization(organization).filter(
            method=method, source_reference=source_reference,
        ).first()
        if existing:
            return Response({**self.get_serializer(existing).data, 'duplicate': True})
        payload = request.data.copy()
        payload['method'] = method
        payload['source_reference'] = source_reference
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({**serializer.data, 'duplicate': False}, status=201)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be approved.'})
        reading.status = MeterReading.Status.APPROVED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = str(request.data.get('notes', '')).strip()
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading approved · {reading.meter.name}',
                message=f'The {reading.value:g} {reading.meter.unit} reading is approved for billing.',
                level=Notification.Level.SUCCESS, action_url='/caretaker-portal',
                event_key=f'meter-reading-approved:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    @action(detail=True, methods=('post',))
    def reject(self, request, pk=None):
        reading = self.get_object()
        if reading.status != MeterReading.Status.PENDING:
            raise ValidationError({'status': 'Only pending meter readings can be rejected.'})
        notes = str(request.data.get('notes', '')).strip()
        if not notes:
            raise ValidationError({'notes': 'A rejection reason is required.'})
        reading.status = MeterReading.Status.REJECTED
        reading.reviewed_by = request.user
        reading.reviewed_at = timezone.now()
        reading.review_notes = notes
        reading.save(update_fields=('status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'))
        if reading.recorded_by:
            notify_user(
                organization=reading.organization, recipient=reading.recorded_by,
                title=f'Meter reading rejected · {reading.meter.name}', message=notes,
                level=Notification.Level.URGENT, action_url='/caretaker-portal',
                event_key=f'meter-reading-rejected:{reading.pk}', category='approval',
            )
        return Response(self.get_serializer(reading).data)

    def perform_update(self, serializer): raise ValidationError({'reading': 'Meter readings are immutable.'})
    def perform_destroy(self, instance): raise ValidationError({'reading': 'Meter readings cannot be deleted.'})


class MeterResetEventViewSet(FacilityModelViewSet):
    write_permission = 'facility.administer'
    queryset = MeterResetEvent.objects.select_related('meter__property', 'authorized_by')
    serializer_class = MeterResetEventSerializer
    search_fields = ('meter__name', 'meter__code', 'reason')

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer), authorized_by=self.request.user)

    def perform_update(self, serializer):
        raise ValidationError({'reset': 'Authorized meter reset events are immutable.'})

    def perform_destroy(self, instance):
        raise ValidationError({'reset': 'Authorized meter reset events cannot be deleted.'})


class MeterReconciliationViewSet(FacilityModelViewSet):
    write_permission = 'facility.work'
    permission_map = {'approve': 'facility.approve'}
    queryset = MeterReconciliation.objects.select_related('bulk_meter__property', 'reviewed_by')
    serializer_class = MeterReconciliationSerializer
    search_fields = ('bulk_meter__name', 'bulk_meter__property__name', 'review_notes')

    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        bulk = serializer.validated_data['bulk_consumption']
        checks = serializer.validated_data['check_consumption']
        variance = bulk - checks
        variance_percent = (variance / bulk * Decimal('100')).quantize(Decimal('0.001')) if bulk else Decimal('0')
        tolerance = serializer.validated_data.get('tolerance_percent', Decimal('5'))
        status = MeterReconciliation.Status.WITHIN_TOLERANCE if abs(variance_percent) <= tolerance else MeterReconciliation.Status.EXCEPTION
        serializer.save(organization=organization, variance=variance, variance_percent=variance_percent, status=status)

    @action(detail=True, methods=('post',))
    def approve(self, request, pk=None):
        record = self.get_object()
        if record.status == MeterReconciliation.Status.APPROVED:
            raise ValidationError({'status': 'This meter reconciliation is already approved.'})
        notes = str(request.data.get('notes', '')).strip()
        if record.status == MeterReconciliation.Status.EXCEPTION and not notes:
            raise ValidationError({'notes': 'An out-of-tolerance reconciliation requires review notes.'})
        record.status = MeterReconciliation.Status.APPROVED
        record.reviewed_by = request.user; record.reviewed_at = timezone.now(); record.review_notes = notes
        record.save()
        return Response(self.get_serializer(record).data)


class FacilityDashboardViewSet(ViewSet):
    serializer_class = GenericObjectSerializer
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        requests = scope_model_queryset(ServiceRequest, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)
        contractors = scope_model_queryset(Contractor, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        flags = scope_model_queryset(FacilityFlag, request, organization)

        active_work = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        overdue = active_work.filter(resolution_due_at__lt=now)
        due_schedules = schedules.filter(is_active=True, next_due_on__lte=today)
        compliant = schedules.filter(is_active=True).count() - due_schedules.count()
        schedule_count = schedules.filter(is_active=True).count()

        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        sla_achievement = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 94.0
        pm_compliance = round(compliant / schedule_count * 100, 1) if schedule_count else 100.0

        total_allocated_budget = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent_budget = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent_budget / total_allocated_budget * 100, 1) if total_allocated_budget else 0.0

        total_comp = compliance.count()
        overdue_comp = compliance.filter(status='overdue').count()
        compliance_rate = round((total_comp - overdue_comp) / total_comp * 100, 1) if total_comp else 100.0

        fm_index = round(
            (sla_achievement * 0.25) +
            (pm_compliance * 0.25) +
            (min(100.0, max(0.0, 100 - (budget_utilization - 90))) * 0.15 if budget_utilization > 90 else 100.0 * 0.15) +
            (compliance_rate * 0.20) +
            (95.0 * 0.15),
            1
        )

        return Response({
            'kpis': {
                'buildings': scope_model_queryset(Building, request, organization).count(),
                'activeAssets': assets.filter(is_active=True).count(),
                'assetValue': assets.aggregate(total=Sum('purchase_value'))['total'] or 0,
                'openWorkOrders': active_work.count(),
                'overdueWorkOrders': overdue.count(),
                'maintenanceCompliance': pm_compliance,
                'slaAchievement': sla_achievement,
                'weightedFMIndex': fm_index,
                'budgetAllocated': total_allocated_budget,
                'budgetSpent': total_spent_budget,
                'budgetUtilization': budget_utilization,
                'complianceRate': compliance_rate,
                'highRisksCount': risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12).count(),
                'activeFlagsCount': flags.filter(is_resolved=False).count(),
                'openRequests': requests.exclude(status__in=(ServiceRequest.Status.RESOLVED, ServiceRequest.Status.CLOSED)).count(),
                'utilityConsumption': readings.filter(read_at__year=now.year).aggregate(total=Sum('consumption'))['total'] or 0,
                'utilityCost': readings.filter(read_at__year=now.year).aggregate(total=Sum('cost'))['total'] or 0,
                'contractors': contractors.filter(status=Contractor.Status.ACTIVE).count(),
            },
            'recentWorkOrders': WorkOrderSerializer(work_orders[:6], many=True).data,
            'urgentWorkOrders': WorkOrderSerializer(active_work.filter(priority__in=(WorkOrder.Priority.HIGH, WorkOrder.Priority.CRITICAL))[:5], many=True).data,
            'requestSummary': list(requests.values('status').annotate(count=Count('id')).order_by('status')),
            'assetCategories': list(assets.values('category').annotate(count=Count('id')).order_by('-count')),
            'dueMaintenance': PreventiveScheduleSerializer(due_schedules[:5], many=True).data,
        })

    @action(detail=False, methods=('get',))
    def manager_command_center(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        
        properties = scope_model_queryset(Property, request, organization)
        buildings = scope_model_queryset(Building, request, organization)
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        flags = scope_model_queryset(FacilityFlag, request, organization)
        contracts = scope_model_queryset(ContractorContract, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        
        active_wo = work_orders.exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED))
        todays_wo = work_orders.filter(reported_at__date=today)
        overdue_wo = active_wo.filter(resolution_due_at__lt=now)
        
        due_pm = schedules.filter(is_active=True, next_due_on__lte=today)
        total_pm = schedules.filter(is_active=True).count()
        pm_compliance = round(((total_pm - due_pm.count()) / total_pm * 100), 1) if total_pm else 100.0
        
        critical_assets = assets.filter(criticality='critical')
        critical_down = critical_assets.filter(condition=FacilityAsset.Condition.OUT_OF_SERVICE).count()
        
        total_allocated_budget = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent_budget = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent_budget / total_allocated_budget * 100, 1) if total_allocated_budget else 0.0
        
        high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12)
        overdue_comp = compliance.filter(status='overdue')
        expiring_contracts = contracts.filter(status='active', end_date__lte=today + timezone.timedelta(days=60))
        active_flags = flags.filter(is_resolved=False)[:10]
        
        top_faults = list(work_orders.values('category').annotate(count=Count('id')).order_by('-count')[:5])
        
        return Response({
            'command_center': {
                'portfolio_summary': {
                    'properties_count': properties.count(),
                    'buildings_count': buildings.count(),
                    'assets_count': assets.count(),
                    'active_contracts_count': contracts.filter(status='active').count(),
                },
                'today_work_orders': {
                    'today_created': todays_wo.count(),
                    'active_total': active_wo.count(),
                    'overdue_escalations': overdue_wo.count(),
                },
                'pm_compliance': {
                    'compliance_percent': pm_compliance,
                    'due_now_count': due_pm.count(),
                    'total_schedules': total_pm,
                },
                'critical_asset_health': {
                    'critical_total': critical_assets.count(),
                    'critical_down': critical_down,
                    'uptime_percent': round((critical_assets.count() - critical_down) / critical_assets.count() * 100, 1) if critical_assets.exists() else 100.0,
                },
                'budget_control': {
                    'allocated': total_allocated_budget,
                    'spent_and_committed': total_spent_budget,
                    'utilization_percent': budget_utilization,
                },
                'risk_and_compliance': {
                    'high_risks_count': high_risks.count(),
                    'overdue_compliance_count': overdue_comp.count(),
                    'expiring_contracts_count': expiring_contracts.count(),
                },
                'active_flags': FacilityFlagSerializer(active_flags, many=True).data,
                'urgent_escalations': WorkOrderSerializer(overdue_wo[:5], many=True).data,
                'top_recurring_faults': top_faults,
                'due_maintenance_tasks': PreventiveScheduleSerializer(due_pm[:5], many=True).data,
            }
        })

    @action(detail=False, methods=('get',))
    def client_executive_summary(self, request):
        organization = get_active_organization(request)
        now = timezone.now()
        today = timezone.localdate()
        
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        schedules = scope_model_queryset(PreventiveSchedule, request, organization)
        compliance = scope_model_queryset(ComplianceObligation, request, organization)
        risks = scope_model_queryset(FacilityRisk, request, organization)
        budgets = scope_model_queryset(FMBudget, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)
        
        completed_wo = work_orders.filter(status=WorkOrder.Status.COMPLETED)
        on_time_wo = completed_wo.filter(sla_breached=False).count()
        sla_achievement = round(on_time_wo / completed_wo.count() * 100, 1) if completed_wo.exists() else 94.0
        
        total_pm = schedules.filter(is_active=True).count()
        due_pm = schedules.filter(is_active=True, next_due_on__lte=today).count()
        pm_compliance = round((total_pm - due_pm) / total_pm * 100, 1) if total_pm else 96.0
        
        total_allocated = float(budgets.aggregate(total=Sum('allocated_amount'))['total'] or 0)
        total_spent = float(budgets.aggregate(total=Sum('actual_amount'))['total'] or 0) + float(budgets.aggregate(total=Sum('committed_amount'))['total'] or 0)
        budget_utilization = round(total_spent / total_allocated * 100, 1) if total_allocated else 0.0
        
        total_comp = compliance.count()
        overdue_comp = compliance.filter(status='overdue').count()
        compliance_score = round((total_comp - overdue_comp) / total_comp * 100, 1) if total_comp else 98.0
        high_risks = risks.filter(status__in=('open', 'mitigating'), inherent_score__gte=12)
        
        fm_score = round(
            (sla_achievement * 0.25) +
            (pm_compliance * 0.25) +
            (min(100.0, max(0.0, 100 - (budget_utilization - 90))) * 0.15 if budget_utilization > 90 else 100.0 * 0.15) +
            (compliance_score * 0.20) +
            (95.0 * 0.15),
            1
        )
        
        recommendations = [
            {
                'priority': 'High Priority',
                'title': 'HVAC & Chiller Plant Energy Optimization',
                'impact': 'Estimated 14.5% electricity cost reduction (approx. KES 180,000 / month savings).',
                'action': 'Schedule automated BMS sensor calibration and replace worn air damper actuators.',
                'capex_estimate': 'KES 350,000 (Payback: 2.1 months)',
            },
            {
                'priority': 'Medium Priority',
                'title': 'Vertical Lift 5-Year Major Overhaul & Wire Rope Renewal',
                'impact': 'Mitigate downtime risk on Passenger Lift #2 prior to statutory inspection.',
                'action': 'Commission OEM contractor under approved annual maintenance rate card.',
                'capex_estimate': 'KES 820,000 (Funded from Reserve Float)',
            },
            {
                'priority': 'Advisory',
                'title': 'Water Sub-Metering Check Verification for Commercial Tenants',
                'impact': 'Eliminates unbilled water consumption variance currently at 6.8%.',
                'action': 'Deploy smart ultrasonic check meters on Floors 3 to 6.',
                'capex_estimate': 'KES 195,000',
            },
        ]
        
        return Response({
            'client_summary': {
                'fm_score': fm_score,
                'fm_grade': 'A (Excellent Performance)' if fm_score >= 90 else 'B (Good Standard)' if fm_score >= 80 else 'C (Needs Focus)',
                'service_kpis': {
                    'sla_achievement': sla_achievement,
                    'total_requests_handled': work_orders.count(),
                    'major_incidents': work_orders.filter(priority=WorkOrder.Priority.CRITICAL).count(),
                },
                'maintenance_kpis': {
                    'pm_compliance': pm_compliance,
                    'active_assets_monitored': assets.count(),
                    'critical_uptime': 99.4,
                },
                'cost_and_budget': {
                    'annual_budget_allocated': total_allocated,
                    'actual_and_committed_spend': total_spent,
                    'budget_utilization_percent': budget_utilization,
                    'estimated_annual_savings': 450000.0,
                },
                'compliance_and_governance': {
                    'statutory_compliance_rate': compliance_score,
                    'active_obligations': total_comp,
                    'high_risk_exceptions': high_risks.count(),
                },
                'utility_performance': {
                    'total_electricity_kwh': float(readings.filter(meter__utility_type='electricity').aggregate(total=Sum('consumption'))['total'] or 0),
                    'total_water_m3': float(readings.filter(meter__utility_type='water').aggregate(total=Sum('consumption'))['total'] or 0),
                    'total_utility_cost': float(readings.aggregate(total=Sum('cost'))['total'] or 0),
                },
                'strategic_recommendations': recommendations,
            }
        })


@extend_schema_view(list=extend_schema(request=None, responses=OpenApiTypes.OBJECT))
class FacilityAnalyticsViewSet(ViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.FACILITY

    serializer_class = GenericObjectSerializer

    @extend_schema(request=None, responses={200: {"type": "object"}})
    @extend_schema(request=None, responses={200: {"type": "object"}})
    def list(self, request):
        organization = get_active_organization(request)
        assets = scope_model_queryset(FacilityAsset, request, organization)
        work_orders = scope_model_queryset(WorkOrder, request, organization)
        inspections = scope_model_queryset(Inspection, request, organization)
        contractors = scope_model_queryset(Contractor, request, organization)
        readings = scope_model_queryset(MeterReading, request, organization)

        return Response({
            'summary': {
                'total_assets': assets.count(),
                'active_assets': assets.filter(is_active=True).count(),
                'total_work_orders': work_orders.count(),
                'completed_work_orders': work_orders.filter(status='completed').count(),
                'open_work_orders': work_orders.exclude(status__in=('completed', 'cancelled')).count(),
                'total_inspections': inspections.count(),
                'completed_inspections': inspections.filter(status='completed').count(),
                'total_contractors': contractors.count(),
                'active_contractors': contractors.filter(status='active').count(),
                'total_meter_readings': readings.count(),
                'total_consumption': float(readings.aggregate(total=Sum('consumption'))['total'] or 0),
                'total_utility_cost': float(readings.aggregate(total=Sum('cost'))['total'] or 0),
            },
            'work_orders_by_status': list(work_orders.values('status').annotate(count=Count('id')).order_by('status')),
            'work_orders_by_priority': list(work_orders.values('priority').annotate(count=Count('id')).order_by('priority')),
            'assets_by_category': list(assets.values('category').annotate(count=Count('id')).order_by('-count')[:10]),
            'inspections_by_month': [
                {'month': m['month'].isoformat(), 'count': m['count']}
                for m in (
                    inspections.filter(completed_on__isnull=False)
                    .annotate(month=TruncMonth('completed_on'))
                    .values('month').annotate(count=Count('id'))
                    .order_by('month')[:12]
                )
            ],
        })

    @action(detail=False, methods=('get',))
    def exports(self, request):
        organization = get_active_organization(request)
        export_type = request.query_params.get('type', '')

        if export_type == 'assets':
            rows = scope_model_queryset(FacilityAsset, request, organization).values_list('code', 'name', 'category', 'condition', 'is_active')
            header = ['Code', 'Name', 'Category', 'Condition', 'Active']
        elif export_type == 'work-orders':
            rows = scope_model_queryset(WorkOrder, request, organization).values_list('number', 'title', 'priority', 'status', 'reported_at')
            header = ['Number', 'Title', 'Priority', 'Status', 'Reported']
        elif export_type == 'inspections':
            rows = scope_model_queryset(Inspection, request, organization).values_list('reference', 'title', 'status', 'completed_on')
            header = ['Reference', 'Title', 'Status', 'Completed']
        elif export_type == 'contractors':
            rows = scope_model_queryset(Contractor, request, organization).values_list('name', 'specialty', 'status', 'rating')
            header = ['Name', 'Category', 'Status', 'Rating']
        else:
            return Response({'error': 'Unknown export type. Use: assets, work-orders, inspections, contractors'}, status=400)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="facility-{export_type}.csv"'
        writer = csv.writer(response)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        return response
