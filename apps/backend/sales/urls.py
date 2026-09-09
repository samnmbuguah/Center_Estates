from rest_framework.routers import DefaultRouter

from .views import AgentPortalViewSet, BuyerViewSet, BuyerPortalAccessViewSet, BuyerPortalViewSet, CommissionViewSet, InstallmentViewSet, ListingViewSet, PaymentViewSet, SaleDocumentViewSet, SalesAnalyticsViewSet, SalesAuditEventViewSet, SaleViewSet, SalesDashboardViewSet, SiteVisitViewSet

router = DefaultRouter()
router.register('dashboard', SalesDashboardViewSet, basename='sales-dashboard')
router.register('analytics', SalesAnalyticsViewSet, basename='sales-analytics')
router.register('inventory', ListingViewSet)
router.register('buyers', BuyerViewSet)
router.register('buyer-portal-access', BuyerPortalAccessViewSet)
router.register('sales', SaleViewSet)
router.register('installments', InstallmentViewSet)
router.register('payments', PaymentViewSet)
router.register('site-visits', SiteVisitViewSet)
router.register('commissions', CommissionViewSet)
router.register('documents', SaleDocumentViewSet)
router.register('audit-events', SalesAuditEventViewSet)
router.register('buyer-portal', BuyerPortalViewSet, basename='buyer-portal')
router.register('agent-portal', AgentPortalViewSet, basename='agent-portal')

urlpatterns = router.urls
