from rest_framework.routers import DefaultRouter

from .views import BuyerViewSet, CommissionViewSet, InstallmentViewSet, ListingViewSet, PaymentViewSet, SaleDocumentViewSet, SalesAuditEventViewSet, SaleViewSet, SalesDashboardViewSet, SiteVisitViewSet

router = DefaultRouter()
router.register('dashboard', SalesDashboardViewSet, basename='sales-dashboard')
router.register('inventory', ListingViewSet)
router.register('buyers', BuyerViewSet)
router.register('sales', SaleViewSet)
router.register('installments', InstallmentViewSet)
router.register('payments', PaymentViewSet)
router.register('site-visits', SiteVisitViewSet)
router.register('commissions', CommissionViewSet)
router.register('documents', SaleDocumentViewSet)
router.register('audit-events', SalesAuditEventViewSet)

urlpatterns = router.urls
