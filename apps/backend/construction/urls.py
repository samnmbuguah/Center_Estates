from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAuditLogViewSet, AdvancePaymentViewSet, BimDiscrepancyViewSet, BimModelViewSet,
    BoQItemViewSet, CalendarEventViewSet, CertificateViewSet,
    ChatMessageViewSet, ConsultantPaymentViewSet, ContingencyDrawdownViewSet, DailyLogViewSet,
    DashboardViewSet, DisbursementViewSet, DrawdownRequestViewSet,
    DroneDatasetViewSet, EvidenceViewSet, LifecycleViewSet,
    MaterialDeliveryViewSet, MilestoneViewSet, NotificationViewSet, ProjectApprovalViewSet,
    ProjectDocumentViewSet, ProjectViewSet, ProvisionalSumViewSet,
    QualityTestViewSet, RequisitionViewSet, RfiViewSet, RiskViewSet,
    SafetyIncidentViewSet, SatelliteDatasetViewSet, SubcontractorViewSet,
    TicketViewSet, VariationViewSet, WorkOrderViewSet, WorkPlanTaskViewSet,
)
from core.views import MobileTokenView
from .sync_views import media_upload, mobile_me, pull, push, register_device, verify_submission
from .report_views import project_report

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
router.register("lifecycle", LifecycleViewSet, basename="construction-lifecycle")
router.register("materials", MaterialDeliveryViewSet, basename="construction-material")
router.register("consultant-payments", ConsultantPaymentViewSet, basename="construction-consultant-payment")
router.register("drone-datasets", DroneDatasetViewSet, basename="construction-drone")
router.register("satellite-datasets", SatelliteDatasetViewSet, basename="construction-satellite")
router.register("provisional-sums", ProvisionalSumViewSet, basename="construction-provisional-sum")
router.register("contingency-drawdowns", ContingencyDrawdownViewSet, basename="construction-contingency")
router.register("advance-payments", AdvancePaymentViewSet, basename="construction-advance")
router.register("subcontractors", SubcontractorViewSet, basename="construction-subcontractor")
router.register("work-orders", WorkOrderViewSet, basename="construction-work-order")
router.register("bim-models", BimModelViewSet, basename="construction-bim")
router.register("bim-discrepancies", BimDiscrepancyViewSet, basename="construction-bim-discrepancy")
router.register("requisitions", RequisitionViewSet, basename="construction-requisition")
router.register("certificates", CertificateViewSet, basename="construction-certificate")
router.register("disbursements", DisbursementViewSet, basename="construction-disbursement")
router.register("drawdowns", DrawdownRequestViewSet, basename="construction-drawdown")
router.register("chat", ChatMessageViewSet, basename="construction-chat")
router.register("notifications", NotificationViewSet, basename="construction-notification")
router.register("audit-log", AdminAuditLogViewSet, basename="construction-audit-log")

urlpatterns = router.urls
urlpatterns += [
    path("auth/token/", MobileTokenView.as_view(), name="construction-mobile-token"),
    path("me", mobile_me, name="construction-mobile-me"),
    path("sync/pull", pull, name="construction-sync-pull"),
    path("sync/push", push, name="construction-sync-push"),
    path("media/upload", media_upload, name="construction-media-upload"),
    path("devices/register", register_device, name="construction-device-register"),
    path("audit/verify/<str:milestone_id>", verify_submission, name="construction-audit-verify"),
    path("reports/<str:project_id>/", project_report, name="construction-project-report"),
]
