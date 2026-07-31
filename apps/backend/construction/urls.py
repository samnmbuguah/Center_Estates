from rest_framework.routers import DefaultRouter

from .views import (
    BoQItemViewSet, CalendarEventViewSet, DailyLogViewSet, DashboardViewSet,
    EvidenceViewSet, MilestoneViewSet, ProjectApprovalViewSet,
    ProjectDocumentViewSet, ProjectViewSet, QualityTestViewSet, RfiViewSet,
    RiskViewSet, SafetyIncidentViewSet, TicketViewSet, VariationViewSet,
    WorkPlanTaskViewSet,
)

router = DefaultRouter()
router.register("dashboard", DashboardViewSet, basename="construction-dashboard")
router.register("projects", ProjectViewSet, basename="construction-project")
router.register("milestones", MilestoneViewSet, basename="construction-milestone")
router.register("evidence", EvidenceViewSet, basename="construction-evidence")
router.register("daily-logs", DailyLogViewSet, basename="construction-daily-log")
router.register("risks", RiskViewSet, basename="construction-risk")
router.register("tickets", TicketViewSet, basename="construction-ticket")
router.register("work-plan", WorkPlanTaskViewSet, basename="construction-work-plan")
router.register("boq", BoQItemViewSet, basename="construction-boq")
router.register("variations", VariationViewSet, basename="construction-variation")
router.register("quality-tests", QualityTestViewSet, basename="construction-quality-test")
router.register("rfis", RfiViewSet, basename="construction-rfi")
router.register("safety-incidents", SafetyIncidentViewSet, basename="construction-safety")
router.register("calendar", CalendarEventViewSet, basename="construction-calendar")
router.register("documents", ProjectDocumentViewSet, basename="construction-document")
router.register("approvals", ProjectApprovalViewSet, basename="construction-approval")

urlpatterns = router.urls
