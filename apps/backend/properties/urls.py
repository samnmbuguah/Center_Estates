from rest_framework.routers import DefaultRouter

from .views import (
    BuildingViewSet, BudgetViewSet, CreditNoteViewSet, ExpenseViewSet,
    InvoiceViewSet, LeaseViewSet, ProjectViewSet, PropertyDashboardViewSet,
    PropertyViewSet, ReceiptAllocationViewSet, ReceiptViewSet,
    RentScheduleViewSet, ServiceChargeViewSet, TenantDocumentViewSet,
    TenantViewSet, UnitViewSet,
)

router = DefaultRouter()
router.register('dashboard', PropertyDashboardViewSet, basename='property-dashboard')
router.register('properties', PropertyViewSet)
router.register('buildings', BuildingViewSet)
router.register('units', UnitViewSet)
router.register('projects', ProjectViewSet)
router.register('tenants', TenantViewSet)
router.register('leases', LeaseViewSet)
router.register('invoices', InvoiceViewSet)
router.register('receipts', ReceiptViewSet)
router.register('expenses', ExpenseViewSet)
router.register('budgets', BudgetViewSet)
router.register('service-charges', ServiceChargeViewSet)
router.register('tenant-documents', TenantDocumentViewSet)
router.register('rent-schedules', RentScheduleViewSet)
router.register('receipt-allocations', ReceiptAllocationViewSet)
router.register('credit-notes', CreditNoteViewSet)

urlpatterns = router.urls
