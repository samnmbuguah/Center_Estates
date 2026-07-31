from rest_framework.routers import DefaultRouter
from .views import AuditEventViewSet,ClientViewSet,ComparableViewSet,DashboardViewSet,DraftViewSet,FinalViewSet,InspectionViewSet,InstructionViewSet,InvoiceViewSet,PaymentViewSet
r=DefaultRouter();r.register('dashboard',DashboardViewSet,basename='valuation-dashboard');r.register('clients',ClientViewSet);r.register('instructions',InstructionViewSet);r.register('inspections',InspectionViewSet);r.register('comparables',ComparableViewSet);r.register('draft-reports',DraftViewSet);r.register('final-reports',FinalViewSet);r.register('invoices',InvoiceViewSet);r.register('payments',PaymentViewSet);r.register('audit-events',AuditEventViewSet)
urlpatterns=r.urls
