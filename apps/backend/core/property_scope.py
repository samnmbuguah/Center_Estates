from __future__ import annotations

from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q

from properties.models import Property


PROPERTY_LOOKUPS = {
    # Property management
    'properties.Property': 'pk',
    'properties.Building': 'property_id',
    'properties.Unit': 'property_id',
    'properties.Project': 'property_id',
    'properties.Tenant': 'property_id',
    'properties.TenantPortalAccess': 'tenant__leases__unit__property_id',
    'properties.Lease': 'unit__property_id',
    'properties.Invoice': 'lease__unit__property_id',
    'properties.Receipt': 'invoice__lease__unit__property_id',
    'properties.InvoiceReminder': 'invoice__lease__unit__property_id',
    'properties.BankTransaction': 'receipt__invoice__lease__unit__property_id',
    'properties.Expense': 'property_id',
    'properties.Budget': 'property_id',
    'properties.ServiceCharge': 'property_id',
    'properties.ServiceChargeAllocation': 'service_charge__property_id',
    'properties.ServiceChargeReconciliation': 'service_charge__property_id',
    'properties.TenantDocument': 'tenant__leases__unit__property_id',
    'properties.RentSchedule': 'lease__unit__property_id',
    'properties.ReceiptAllocation': 'invoice__lease__unit__property_id',
    'properties.CreditNote': 'invoice__lease__unit__property_id',
    # Facility management
    'facilities.FacilityAsset': 'property_id',
    'facilities.WorkOrder': 'property_id',
    'facilities.WorkOrderEvent': 'work_order__property_id',
    'facilities.WorkOrderCostItem': 'work_order__property_id',
    'facilities.WorkOrderAttachment': 'work_order__property_id',
    'facilities.PreventiveSchedule': 'asset__property_id',
    'facilities.Inspection': 'property_id',
    'facilities.ServiceRequest': 'property_id',
    'facilities.UtilityMeter': 'property_id',
    'facilities.MeterReading': 'meter__property_id',
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


def get_active_property(request, organization, *, required=False):
    if request.headers.get('X-Property-Scope', '').lower() == 'portfolio':
        return None
    property_id = request.headers.get('X-Property-ID') or request.query_params.get('property')
    if not property_id:
        if required:
            raise ValidationError({'property': 'Select a property before opening this workspace.'})
        return None
    property_record = Property.objects.filter(pk=property_id, organization=organization).first()
    if property_record is None:
        raise PermissionDenied('The selected property is not available in this organization.')
    return property_record


def scope_queryset_to_property(queryset, request, organization):
    property_record = get_active_property(request, organization)
    if property_record is None:
        return queryset
    if queryset.model._meta.label == 'properties.Tenant':
        return queryset.filter(
            Q(property_id=property_record.pk) | Q(leases__unit__property_id=property_record.pk),
        ).distinct()
    lookup = PROPERTY_LOOKUPS.get(queryset.model._meta.label)
    if not lookup:
        return queryset
    return queryset.filter(**{lookup: property_record.pk}).distinct()


def scope_model_queryset(model, request, organization):
    return scope_queryset_to_property(model.objects.for_organization(organization), request, organization)
