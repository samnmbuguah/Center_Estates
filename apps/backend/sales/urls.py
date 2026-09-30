from django.urls import path
from rest_framework.routers import DefaultRouter

from .public_views import public_enquiry, public_listing_detail, public_listings, public_projects
from .views import (
    AgentPortalViewSet, BuyerViewSet, BuyerPortalAccessViewSet, BuyerPortalViewSet,
    CommissionViewSet, InstallmentViewSet, ListingRenderViewSet, ListingViewSet,
    PaymentViewSet, SaleDocumentViewSet, SalesAnalyticsViewSet, SalesAuditEventViewSet,
    SalesDashboardViewSet, SalesProjectViewSet, SaleViewSet, SiteVisitViewSet,
)

router = DefaultRouter()
router.register('projects', SalesProjectViewSet)
router.register('dashboard', SalesDashboardViewSet, basename='sales-dashboard')
router.register('analytics', SalesAnalyticsViewSet, basename='sales-analytics')
router.register('inventory', ListingViewSet)
router.register('listing-renders', ListingRenderViewSet)
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

urlpatterns = router.urls + [
    path('public/listings/', public_listings, name='sales-public-listings'),
    path('public/listings/<uuid:pk>/', public_listing_detail, name='sales-public-listing-detail'),
    path('public/projects/', public_projects, name='sales-public-projects'),
    path('public/enquiries/', public_enquiry, name='sales-public-enquiry'),
]
