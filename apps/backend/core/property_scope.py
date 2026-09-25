from __future__ import annotations

from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS
from django.db.models import Q

from properties.models import Property, PropertyModule


def _request_module(request):
    """Resolve the module a request belongs to from its DRF view.

    Every module viewset declares ``required_module``. Reading it here keeps
    enforcement automatic without threading the module through every call site.
    """
    parser_context = getattr(request, 'parser_context', None)
    if not parser_context:
        return None
    view = parser_context.get('view')
    return getattr(view, 'required_module', None) if view is not None else None


def property_module_enabled(organization, property_record, module) -> bool:
    """A property is available for a module unless it is explicitly disabled.

    Absence of an assignment means "not yet curated" and stays available, which
    keeps existing properties working. Disabling creates an assignment row with
    ``is_enabled=False`` so the property is hidden from active pickers while its
    records remain intact.
    """
    if not module or property_record is None:
        return True
    return not PropertyModule.objects.filter(
        organization=organization, property=property_record, module=module, is_enabled=False,
    ).exists()


def filter_properties_by_module(queryset, organization, module):
    if not module or queryset.model._meta.label != 'properties.Property':
        return queryset
    disabled_ids = PropertyModule.objects.filter(
        organization=organization, module=module, is_enabled=False,
    ).values_list('property_id', flat=True)
    return queryset.exclude(pk__in=disabled_ids)


PROPERTY_LOOKUPS = {
    # Property management
    'properties.Building': 'property_id',
    'properties.Unit': 'property_id',
    'properties.Property': 'id',
    'properties.Project': 'property_id',
    'properties.PropertyModule': 'property_id',
    'properties.ProjectModuleAssignment': 'project__property_id',
    'properties.Tenant': 'property_id',
    'properties.TenantPortalAccess': 'tenant__leases__unit__property_id',
    'properties.Lease': 'unit__property_id',
    'properties.LeaseEscalation': 'lease__unit__property_id',
    'properties.UnitStatusHistory': 'unit__property_id',
    'properties.TenantMovement': 'unit__property_id',
    'properties.TenantHandover': 'unit__property_id',
    'properties.ExitClearance': 'lease__unit__property_id',
    'properties.BillingProfile': 'lease__unit__property_id',
    'properties.BillingRun': 'property_id',
    'properties.BillingCandidate': 'lease__unit__property_id',
    'properties.BillingReadinessIssue': 'lease__unit__property_id',
    'properties.Invoice': 'lease__unit__property_id',
    'properties.InvoiceLine': 'invoice__lease__unit__property_id',
    'properties.Receipt': 'invoice__lease__unit__property_id',
    'properties.InvoiceReminder': 'invoice__lease__unit__property_id',
    'properties.BankTransaction': 'receipt__invoice__lease__unit__property_id',
    'properties.PaymentGatewayConfiguration': 'property_id',
    'properties.PaymentIntent': 'invoice__lease__unit__property_id',
    'properties.PaymentWebhookEvent': 'configuration__property_id',
    'properties.Expense': 'property_id',
    'properties.Budget': 'property_id',
    'properties.ServiceCharge': 'property_id',
    'properties.ServiceChargeAllocation': 'service_charge__property_id',
    'properties.ServiceChargeReconciliation': 'service_charge__property_id',
    'properties.TenantDocument': 'tenant__leases__unit__property_id',
    'properties.RentSchedule': 'lease__unit__property_id',
    'properties.ReceiptAllocation': 'invoice__lease__unit__property_id',
    'properties.CreditNote': 'invoice__lease__unit__property_id',
    'properties.ReportExecution': 'property_id',
    'properties.ScheduledReport': 'property_id',
    # Facility management
    'facilities.FacilityAsset': 'property_id',
    'facilities.FloorPlan': 'building__property_id',
    'facilities.Contractor': 'assigned_properties__id',
    'facilities.WorkOrder': 'property_id',
    'facilities.WorkOrderEvent': 'work_order__property_id',
    'facilities.WorkOrderCostItem': 'work_order__property_id',
    'facilities.WorkOrderAttachment': 'work_order__property_id',
    'facilities.PreventiveSchedule': 'asset__property_id',
    'facilities.Inspection': 'property_id',
    'facilities.ServiceRequest': 'property_id',
    'facilities.ServiceProfile': 'properties__id',
    'facilities.ServiceProfileAllocation': 'property_id',
    'facilities.RepairRequisition': 'property_id',
    'facilities.SupplierInvoice': 'property_id',
    'facilities.ProcurementRecord': 'property_id',
    'facilities.ProcurementQuotation': 'procurement__property_id',
    'facilities.LocalPurchaseOrder': 'property_id',
    'facilities.FacilityJobCard': 'property_id',
    'facilities.ContractInvoiceAppraisal': 'invoice__property_id',
    'facilities.FinancePaymentRequest': 'property_id',
    'facilities.FacilityPaymentRecord': 'property_id',
    'facilities.PettyCashVoucher': 'property_id',
    'facilities.FacilityIncident': 'property_id',
    'facilities.FacilityIncidentEvent': 'incident__property_id',
    'facilities.UtilityMeter': 'property_id',
    'facilities.MeterReading': 'meter__property_id',
    'facilities.MeterResetEvent': 'meter__property_id',
    'facilities.MeterReconciliation': 'bulk_meter__property_id',
    'facilities.ServiceLine': 'property_id',
    'facilities.ScorecardVersion': 'service_line__property_id',
    'facilities.ScorecardKPI': 'scorecard_version__service_line__property_id',
    'facilities.ContractorContract': 'property_id',
    'facilities.ServiceAppraisal': 'property_id',
    'facilities.AppraisalItemResult': 'appraisal__property_id',
    'facilities.ImprovementAction': 'appraisal__property_id',
    'facilities.FMBudget': 'property_id',
    'facilities.FacilityExpense': 'property_id',
    'facilities.ComplianceObligation': 'property_id',
    # Sales management
    'sales.SaleListing': 'unit__property_id',
    'sales.Buyer': 'sales__listing__unit__property_id',
    'sales.PropertySale': 'listing__unit__property_id',
    'sales.Installment': 'sale__listing__unit__property_id',
    'sales.SalePayment': 'sale__listing__unit__property_id',
    'sales.SiteVisit': 'project__property_id',
    'sales.AgentCommission': 'sale__listing__unit__property_id',
    'sales.SaleDocument': 'sale__listing__unit__property_id',
    'sales.SalesAuditEvent': 'sale__listing__unit__property_id',
    # Valuation management
    'valuations.ValuationInstruction': 'property_id',
    'valuations.ValuationInspection': 'instruction__property_id',
    'valuations.ComparableEvidence': 'instruction__property_id',
    'valuations.DraftValuationReport': 'instruction__property_id',
    'valuations.FinalValuationReport': 'instruction__property_id',
    'valuations.ValuationInvoice': 'instruction__property_id',
    'valuations.ValuationPayment': 'invoice__instruction__property_id',
    'valuations.ValuationAuditEvent': 'instruction__property_id',
    # Companion work and tender pipelines
    'companion.Task': 'property_id',
    'companion.TaskEvent': 'task__property_id',
    'companion.TeamFeedbackThread': 'property_id',
    'companion.TeamFeedbackMessage': 'thread__property_id',
    'tenders.Tender': 'property_id',
    'tenders.TenderRequirement': 'tender__property_id',
    'tenders.BidDecision': 'tender__property_id',
    'tenders.TenderTask': 'tender__property_id',
    'tenders.ProposalSection': 'tender__property_id',
    'tenders.FinancialItem': 'tender__property_id',
    'tenders.TenderReview': 'tender__property_id',
    'tenders.TenderSubmission': 'tender__property_id',
    'tenders.TenderOutcome': 'tender__property_id',
    'tenders.TenderAuditEvent': 'tender__property_id',
}


def is_property_manager_restricted(user, organization) -> bool:
    """Return True if user is a property manager who should only see created/assigned properties."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return False
    membership = organization.memberships.filter(user=user, status='active').first()
    if not membership:
        return False
    if membership.is_organization_admin:
        return False
    return membership.roles.filter(slug='property-manager').exists()


def get_accessible_property_ids(user, organization):
    """Return Property IDs that this user has permission to view/manage."""
    membership = organization.memberships.filter(user=user, status='active').first()
    if not membership:
        return Property.objects.none().values_list('id', flat=True)
    return Property.objects.filter(organization=organization).filter(
        Q(created_by=user) | Q(assigned_memberships=membership)
    ).values_list('id', flat=True)


def get_active_property(request, organization, *, required=False):
    if request.headers.get('X-Property-Scope', '').lower() == 'portfolio':
        return None
    property_id = request.headers.get('X-Property-ID') or request.query_params.get('property')
    if not property_id:
        if required:
            raise ValidationError({'property': 'Select a property before opening this workspace.'})
        return None
    cache_key = f'{organization.pk}:{property_id}'
    cached = getattr(request, '_active_property_cache', {}).get(cache_key)
    if cached is not None:
        return cached
    # Guard against non-UUID values (e.g. bare integers) that would cause a 500
    import uuid as _uuid
    try:
        _uuid.UUID(str(property_id))
    except (ValueError, AttributeError):
        raise ValidationError({'property': 'Invalid property ID format. Expected a UUID.'})
    property_record = Property.objects.filter(pk=property_id, organization=organization).first()
    if property_record is None:
        if required or request.method not in SAFE_METHODS:
            raise PermissionDenied('The selected property is not available in this organization.')
        return None
    if is_property_manager_restricted(request.user, organization):
        accessible_ids = get_accessible_property_ids(request.user, organization)
        if not accessible_ids.filter(pk=property_record.pk).exists():
            if required or request.method not in SAFE_METHODS:
                raise PermissionDenied('You do not have permission to view or manage this property.')
            return None
    # A module may be switched off for a property. Block new activity in that
    # module while keeping historical reads available for reporting.
    module = _request_module(request)
    if module and not property_module_enabled(organization, property_record, module):
        if request.method not in SAFE_METHODS:
            raise ValidationError({
                'property': f'This property is not enabled for the {module} module. '
                            f'Enable it before recording new activity.',
            })
    cache = getattr(request, '_active_property_cache', {})
    cache[cache_key] = property_record
    request._active_property_cache = cache
    return property_record


def scope_queryset_to_property(queryset, request, organization):
    # Module-aware property selection: the workspace passes ?module=<slug> so a
    # property disabled for that module disappears from the picker list.
    query_params = getattr(request, 'query_params', None)
    if query_params is not None:
        requested_module = query_params.get('module')
        if requested_module:
            queryset = filter_properties_by_module(queryset, organization, requested_module)
    is_restricted = is_property_manager_restricted(request.user, organization)
    if request.headers.get('X-Property-Scope', '').lower() == 'portfolio':
        if not is_restricted:
            return queryset
        accessible_ids = get_accessible_property_ids(request.user, organization)
        if queryset.model._meta.label == 'properties.Property':
            return queryset.filter(Q(created_by=request.user) | Q(assigned_memberships__user=request.user)).distinct()
        if queryset.model._meta.label == 'properties.Tenant':
            return queryset.filter(
                Q(property_id__in=accessible_ids) | Q(leases__unit__property_id__in=accessible_ids)
            ).distinct()
        if queryset.model._meta.label == 'facilities.Contractor':
            return queryset.filter(
                Q(assigned_properties__id__in=accessible_ids)
                | Q(work_orders__property_id__in=accessible_ids)
                | Q(contracts__property_id__in=accessible_ids)
            ).distinct()
        if queryset.model._meta.label == 'companion.TeamFeedbackThread':
            return queryset.filter(
                Q(property_id__in=accessible_ids)
                | (Q(property__isnull=True) & (Q(created_by=request.user) | Q(assigned_to=request.user)))
            ).distinct()
        if queryset.model._meta.label == 'companion.TeamFeedbackMessage':
            return queryset.filter(
                Q(thread__property_id__in=accessible_ids)
                | (Q(thread__property__isnull=True) & (Q(thread__created_by=request.user) | Q(thread__assigned_to=request.user)))
            ).distinct()
        lookup = PROPERTY_LOOKUPS.get(queryset.model._meta.label)
        if not lookup:
            return queryset
        return queryset.filter(**{f'{lookup}__in': accessible_ids}).distinct()

    property_record = get_active_property(request, organization)
    if property_record is None:
        if not is_restricted:
            return queryset
        accessible_ids = get_accessible_property_ids(request.user, organization)
        if queryset.model._meta.label == 'properties.Property':
            return queryset.filter(Q(created_by=request.user) | Q(assigned_memberships__user=request.user)).distinct()
        if queryset.model._meta.label == 'properties.Tenant':
            return queryset.filter(
                Q(property_id__in=accessible_ids) | Q(leases__unit__property_id__in=accessible_ids)
            ).distinct()
        if queryset.model._meta.label == 'facilities.Contractor':
            return queryset.filter(
                Q(assigned_properties__id__in=accessible_ids)
                | Q(work_orders__property_id__in=accessible_ids)
                | Q(contracts__property_id__in=accessible_ids)
            ).distinct()
        if queryset.model._meta.label == 'companion.TeamFeedbackThread':
            return queryset.filter(
                Q(property_id__in=accessible_ids)
                | (Q(property__isnull=True) & (Q(created_by=request.user) | Q(assigned_to=request.user)))
            ).distinct()
        if queryset.model._meta.label == 'companion.TeamFeedbackMessage':
            return queryset.filter(
                Q(thread__property_id__in=accessible_ids)
                | (Q(thread__property__isnull=True) & (Q(thread__created_by=request.user) | Q(thread__assigned_to=request.user)))
            ).distinct()
        lookup = PROPERTY_LOOKUPS.get(queryset.model._meta.label)
        if not lookup:
            return queryset
        return queryset.filter(**{f'{lookup}__in': accessible_ids}).distinct()

    if queryset.model._meta.label == 'properties.Property':
        # Portfolio callers explicitly opt out above. A module request carrying
        # X-Property-ID must never leak aggregate data from sibling properties.
        return queryset.filter(pk=property_record.pk)
    if queryset.model._meta.label == 'properties.Tenant':
        return queryset.filter(
            Q(property_id=property_record.pk) | Q(leases__unit__property_id=property_record.pk),
        ).distinct()
    if queryset.model._meta.label == 'properties.Invoice':
        # Tenant invoices are associated through a lease, while owner-facing
        # invoices (for example sectional service charge) are associated
        # directly with a unit. Both are records of the selected property.
        return queryset.filter(
            Q(lease__unit__property_id=property_record.pk)
            | Q(unit__property_id=property_record.pk),
        ).distinct()
    if queryset.model._meta.label == 'properties.Receipt':
        # Receipts can be recorded before allocation to an invoice.  Those
        # receipts are still owned by the tenant's selected property and must
        # remain visible in its receipting ledger.
        return queryset.filter(
            Q(invoice__lease__unit__property_id=property_record.pk)
            | Q(tenant__property_id=property_record.pk)
            | Q(tenant__leases__unit__property_id=property_record.pk),
        ).distinct()
    if queryset.model._meta.label == 'properties.BankTransaction':
        # Keep bank items matched to an unallocated receipt reconcilable in
        # that receipt's property, rather than hiding them until allocation.
        return queryset.filter(
            Q(receipt__invoice__lease__unit__property_id=property_record.pk)
            | Q(receipt__tenant__property_id=property_record.pk)
            | Q(receipt__tenant__leases__unit__property_id=property_record.pk),
        ).distinct()
    if queryset.model._meta.label == 'facilities.Contractor':
        return queryset.filter(
            Q(assigned_properties__id=property_record.pk)
            | Q(work_orders__property_id=property_record.pk)
            | Q(contracts__property_id=property_record.pk),
        ).distinct()
    lookup = PROPERTY_LOOKUPS.get(queryset.model._meta.label)
    if not lookup:
        return queryset
    return queryset.filter(**{lookup: property_record.pk}).distinct()


def scope_model_queryset(model, request, organization):
    return scope_queryset_to_property(model.objects.for_organization(organization), request, organization)
