from rest_framework.routers import DefaultRouter
from .views import DashboardViewSet,DecisionViewSet,DocumentViewSet,FinancialViewSet,OutcomeViewSet,ProposalViewSet,RequirementViewSet,ReviewViewSet,SubmissionViewSet,TaskViewSet,TenderViewSet
r=DefaultRouter(); r.register('dashboard',DashboardViewSet,basename='tender-dashboard'); r.register('tenders',TenderViewSet); r.register('requirements',RequirementViewSet); r.register('decisions',DecisionViewSet); r.register('tasks',TaskViewSet); r.register('company-documents',DocumentViewSet); r.register('proposals',ProposalViewSet); r.register('financial-items',FinancialViewSet); r.register('reviews',ReviewViewSet); r.register('submissions',SubmissionViewSet); r.register('outcomes',OutcomeViewSet)
urlpatterns=r.urls
