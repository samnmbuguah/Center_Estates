from rest_framework.routers import DefaultRouter

from .views import (
    BuildingViewSet, BudgetViewSet, CreditNoteViewSet, ExpenseViewSet,
    InvoiceViewSet, LeaseViewSet, ProjectViewSet, PropertyAnalyticsViewSet, PropertyDashboardViewSet,
    PropertyViewSet, ReceiptAllocationViewSet, ReceiptViewSet,
    RentScheduleViewSet, ServiceChargeAllocationViewSet,
    ServiceChargeReconciliationViewSet, ServiceChargeViewSet,
    TenantDocumentViewSet, TenantPortalAccessViewSet, TenantPortalViewSet,
    TenantViewSet, UnitViewSet,
)

router = DefaultRouter()
router.register('dashboard', PropertyDashboardViewSet, basename='property-dashboard')
router.register('properties', PropertyViewSet)
router.register('buildings', BuildingViewSet)
router.register('units', UnitViewSet)
router.register('projects', ProjectViewSet)
router.register('tenants', TenantViewSet)
router.register('tenant-portal-access', TenantPortalAccessViewSet)
router.register('portal', TenantPortalViewSet, basename='tenant-portal')
router.register('leases', LeaseViewSet)
router.register('invoices', InvoiceViewSet)
router.register('receipts', ReceiptViewSet)
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

urlpatterns = router.urls
