from rest_framework.routers import DefaultRouter

from .views import (
    BankTransactionViewSet, BillingItemViewSet, BillingProfileViewSet, BillingRunViewSet,
    BuildingViewSet, BudgetViewSet, CreditNoteViewSet, ParkingSpaceViewSet, ParkingAssignmentViewSet,
    ExpenseViewSet, InvoiceReminderViewSet, InvoiceViewSet, LandlordInvoiceViewSet, LeaseViewSet,
    InvoiceLineViewSet, LeaseEscalationViewSet,
    PaymentGatewayConfigurationViewSet, PaymentIntentViewSet, PaymentWebhookViewSet,
    ProjectViewSet, PropertyAnalyticsViewSet, PropertyDashboardViewSet,
    PropertyViewSet, ReceiptAllocationViewSet, ReceiptViewSet,
    RentScheduleViewSet, ReportDefinitionViewSet, ReportExecutionViewSet, ScheduledReportViewSet,
    ServiceChargeAllocationViewSet,
    ServiceChargeReconciliationViewSet, ServiceChargeViewSet,
    TenantDocumentViewSet, TenantPortalAccessViewSet, TenantPortalViewSet,
    TaxConfigurationViewSet, TenantMovementViewSet, TenantViewSet,
    UnitChargeRuleViewSet, UnitStatusHistoryViewSet, UnitViewSet,
)
from .handover_views import ExitClearanceViewSet, TenantHandoverViewSet

router = DefaultRouter()
router.register('dashboard', PropertyDashboardViewSet, basename='property-dashboard')
router.register('properties', PropertyViewSet)
router.register('buildings', BuildingViewSet)
router.register('parking-spaces', ParkingSpaceViewSet)
router.register('parking-assignments', ParkingAssignmentViewSet)
router.register('units', UnitViewSet)
router.register('unit-charge-rules', UnitChargeRuleViewSet)
router.register('projects', ProjectViewSet)
router.register('tenants', TenantViewSet)
router.register('tenant-portal-access', TenantPortalAccessViewSet)
router.register('portal', TenantPortalViewSet, basename='tenant-portal')
router.register('leases', LeaseViewSet)
router.register('lease-escalations', LeaseEscalationViewSet)
router.register('unit-status-history', UnitStatusHistoryViewSet)
router.register('tenant-movements', TenantMovementViewSet)
router.register('handovers', TenantHandoverViewSet)
router.register('exit-clearances', ExitClearanceViewSet)
router.register('tax-configurations', TaxConfigurationViewSet)
router.register('billing-items', BillingItemViewSet)
router.register('billing-profiles', BillingProfileViewSet)
router.register('billing-runs', BillingRunViewSet)
router.register('invoices', InvoiceViewSet)
router.register('invoice-lines', InvoiceLineViewSet, basename='invoice-line')
router.register('invoice-reminders', InvoiceReminderViewSet, basename='invoice-reminder')
router.register('receipts', ReceiptViewSet)
router.register('bank-transactions', BankTransactionViewSet)
router.register('payment-gateways', PaymentGatewayConfigurationViewSet)
router.register('payment-intents', PaymentIntentViewSet, basename='payment-intent')
router.register('payment-webhooks', PaymentWebhookViewSet, basename='payment-webhook')
router.register('expenses', ExpenseViewSet)
router.register('budgets', BudgetViewSet)
router.register('service-charges', ServiceChargeViewSet)
router.register('service-charge-allocations', ServiceChargeAllocationViewSet, basename='service-charge-allocation')
router.register('service-charge-reconciliations', ServiceChargeReconciliationViewSet, basename='service-charge-reconciliation')
router.register('analytics', PropertyAnalyticsViewSet, basename='property-analytics')
router.register('tenant-documents', TenantDocumentViewSet)
router.register('rent-schedules', RentScheduleViewSet)
router.register('receipt-allocations', ReceiptAllocationViewSet)
router.register('credit-notes', CreditNoteViewSet)
router.register('landlord-invoices', LandlordInvoiceViewSet)
router.register('report-definitions', ReportDefinitionViewSet)
router.register('report-executions', ReportExecutionViewSet, basename='report-execution')
router.register('scheduled-reports', ScheduledReportViewSet)

urlpatterns = router.urls
