from rest_framework.routers import DefaultRouter

from .views import BuildingViewSet, BudgetViewSet, ExpenseViewSet, InvoiceViewSet, LeaseViewSet, ProjectViewSet, PropertyDashboardViewSet, PropertyViewSet, ReceiptViewSet, ServiceChargeViewSet, TenantViewSet, UnitViewSet

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

urlpatterns = router.urls
