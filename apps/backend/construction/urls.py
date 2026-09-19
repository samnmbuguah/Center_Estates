from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAuditLogViewSet, AdvancePaymentViewSet, AdvanceRecoveryViewSet, BimDiscrepancyViewSet, BimModelViewSet,
    BoQItemViewSet, CalendarEventViewSet, CertificateViewSet,
    ChatMessageViewSet, ConsultantPaymentViewSet, ContingencyDrawdownViewSet, DailyLogViewSet,
    DashboardViewSet, DisbursementViewSet, DocumentVersionViewSet, DrawdownRequestViewSet,
    DroneDatasetViewSet, EvidenceViewSet, LifecycleViewSet,
    MaterialDeliveryViewSet, MaterialRequisitionViewSet, MilestoneVerificationViewSet, MilestoneViewSet, NotificationViewSet, ProjectApprovalViewSet,
    ProjectDocumentViewSet, ProjectMembershipViewSet, ProjectViewSet, ProvisionalSumViewSet, RequirementWaiverViewSet,
    QualityTestViewSet, RequisitionViewSet, RfiViewSet, RiskViewSet,
    PurchaseOrderViewSet, SafetyIncidentViewSet, SatelliteDatasetViewSet, StockMovementViewSet, StoreItemViewSet, StoreSupplierViewSet, SubcontractorViewSet,
    TicketCommentViewSet, TicketViewSet, VariationViewSet, WorkOrderViewSet, WorkPlanTaskViewSet,
)
from core.views import MobileTokenView
from .sync_views import media_upload, mobile_me, pull, push, register_device, verify_submission
from .report_views import (
    export_boq_csv, export_cost_csv, export_milestones_csv, monthly_report,
    project_report, project_scurve, project_workspace, weekly_report,
)
from .ingest import (
    convert_project_pdf,
    download_boq_template,
    download_workplan_template,
    generate_milestones_endpoint,
    ingest_commit_json,
    ingestion_preview,
    ingestion_status,
)

router = DefaultRouter()
router.register("dashboard", DashboardViewSet, basename="construction-dashboard")
router.register("projects", ProjectViewSet, basename="construction-project")
router.register("milestones", MilestoneViewSet, basename="construction-milestone")
router.register("milestone-verifications", MilestoneVerificationViewSet, basename="construction-milestone-verification")
router.register("evidence", EvidenceViewSet, basename="construction-evidence")
router.register("daily-logs", DailyLogViewSet, basename="construction-daily-log")
router.register("risks", RiskViewSet, basename="construction-risk")
router.register("tickets", TicketViewSet, basename="construction-ticket")
router.register("work-plan", WorkPlanTaskViewSet, basename="construction-work-plan")
router.register("boq", BoQItemViewSet, basename="construction-boq")
router.register("boq-items", BoQItemViewSet, basename="construction-boq-items")
router.register("variations", VariationViewSet, basename="construction-variation")
router.register("quality-tests", QualityTestViewSet, basename="construction-quality-test")
router.register("rfis", RfiViewSet, basename="construction-rfi")
router.register("safety-incidents", SafetyIncidentViewSet, basename="construction-safety")
router.register("calendar", CalendarEventViewSet, basename="construction-calendar")
router.register("documents", ProjectDocumentViewSet, basename="construction-document")
router.register("document-versions", DocumentVersionViewSet, basename="construction-document-version")
router.register("approvals", ProjectApprovalViewSet, basename="construction-approval")
router.register("requirement-waivers", RequirementWaiverViewSet, basename="construction-requirement-waiver")
router.register("project-memberships", ProjectMembershipViewSet, basename="construction-project-membership")
router.register("lifecycle", LifecycleViewSet, basename="construction-lifecycle")
router.register("materials", MaterialDeliveryViewSet, basename="construction-material")
router.register("consultant-payments", ConsultantPaymentViewSet, basename="construction-consultant-payment")
router.register("drone-datasets", DroneDatasetViewSet, basename="construction-drone")
router.register("satellite-datasets", SatelliteDatasetViewSet, basename="construction-satellite")
router.register("provisional-sums", ProvisionalSumViewSet, basename="construction-provisional-sum")
router.register("contingency-drawdowns", ContingencyDrawdownViewSet, basename="construction-contingency")
router.register("advance-payments", AdvancePaymentViewSet, basename="construction-advance")
router.register("advance-recoveries", AdvanceRecoveryViewSet, basename="construction-advance-recovery")
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
router.register("ticket-comments", TicketCommentViewSet, basename="construction-ticket-comment")
router.register("store-items", StoreItemViewSet, basename="construction-store-item")
router.register("store-suppliers", StoreSupplierViewSet, basename="construction-store-supplier")
router.register("material-requisitions", MaterialRequisitionViewSet, basename="construction-material-requisition")
router.register("purchase-orders", PurchaseOrderViewSet, basename="construction-purchase-order")
router.register("stock-movements", StockMovementViewSet, basename="construction-stock-movement")

urlpatterns = router.urls
urlpatterns += [
    path("auth/token/", MobileTokenView.as_view(), name="construction-mobile-token"),
    path("me", mobile_me, name="construction-mobile-me"),
    path("sync/pull", pull, name="construction-sync-pull"),
    path("sync/push", push, name="construction-sync-push"),
    path("media/upload", media_upload, name="construction-media-upload"),
    path("devices/register", register_device, name="construction-device-register"),
    path("audit/verify/<str:milestone_id>", verify_submission, name="construction-audit-verify"),
    path("reports/weekly/", weekly_report, name="construction-weekly-report"),
    path("reports/monthly/", monthly_report, name="construction-monthly-report"),
    path("reports/scurve/<str:project_id>/", project_scurve, name="construction-scurve"),
    path("projects/<str:project_id>/workspace/", project_workspace, name="construction-project-workspace"),
    path("reports/<str:project_id>/", project_report, name="construction-project-report"),
    path("exports/boq/<str:project_id>.csv", export_boq_csv, name="construction-boq-csv"),
    path("exports/cost/<str:project_id>.csv", export_cost_csv, name="construction-cost-csv"),
    path("exports/milestones/<str:project_id>.csv", export_milestones_csv, name="construction-milestones-csv"),

    # Ingestion & Templates
    path("templates/workplan", download_workplan_template, name="construction-template-workplan"),
    path("templates/workplan/", download_workplan_template, name="construction-template-workplan-slash"),
    path("templates/boq", download_boq_template, name="construction-template-boq"),
    path("templates/boq/", download_boq_template, name="construction-template-boq-slash"),
    path("projects/<str:project_id>/ingest/preview", ingestion_preview, name="construction-project-ingest-preview"),
    path("projects/<str:project_id>/ingest/commit", ingest_commit_json, name="construction-project-ingest-commit"),
    path("projects/<str:project_id>/ingest/status", ingestion_status, name="construction-project-ingest-status"),
    path("projects/<str:project_id>/ingest/generate", generate_milestones_endpoint, name="construction-project-ingest-generate"),
    path("ai/convert-project-pdf", convert_project_pdf, name="construction-ai-convert-project-pdf"),
]

