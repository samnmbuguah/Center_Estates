from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BoQItemViewSet, CalendarEventViewSet, DailyLogViewSet, DashboardViewSet,
    EvidenceViewSet, MilestoneViewSet, ProjectApprovalViewSet,
    ProjectDocumentViewSet, ProjectViewSet, QualityTestViewSet, RfiViewSet,
    RiskViewSet, SafetyIncidentViewSet, TicketViewSet, VariationViewSet,
    WorkPlanTaskViewSet,
)
from core.views import MobileTokenView
from .sync_views import media_upload, mobile_me, pull, push, register_device, verify_submission

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
urlpatterns += [
    path("auth/token/", MobileTokenView.as_view(), name="construction-mobile-token"),
    path("me", mobile_me, name="construction-mobile-me"),
    path("sync/pull", pull, name="construction-sync-pull"),
    path("sync/push", push, name="construction-sync-push"),
    path("media/upload", media_upload, name="construction-media-upload"),
    path("devices/register", register_device, name="construction-device-register"),
    path("audit/verify/<str:milestone_id>", verify_submission, name="construction-audit-verify"),
]
