"""
Construction views package.

This __init__.py re-exports every ViewSet and helper so that urls.py
continues to import from `.views` without any change.

Sub-modules:
  base              – ConstructionScopedViewSet, mixins, scoped_viewset()
  project_views     – ProjectViewSet
  milestone_views   – MilestoneViewSet, MilestoneVerificationViewSet, EvidenceViewSet
  site_views        – Ticket, DailyLog, Variation, BIM, Dashboard, …
  financial_views   – Certificate, Disbursement, Chat, Notification, AdminAuditLog …
  procurement_views – StoreItem, MaterialRequisition, PurchaseOrder, …
"""

# ── Base helpers ──────────────────────────────────────────────────────────────
from .base import (                                         # noqa: F401
    ConstructionScopedViewSet,
    ImmutableSubmittedMixin,
    MobileCaptureMixin,
    apply_project_scope,
    apply_property_scope,
    scoped_viewset,
)

# ── Project ───────────────────────────────────────────────────────────────────
from .project_views import ProjectViewSet                   # noqa: F401

# ── Milestone / Evidence ──────────────────────────────────────────────────────
from .milestone_views import (                              # noqa: F401
    EvidenceViewSet,
    MilestoneVerificationViewSet,
    MilestoneViewSet,
)

# ── Site operations ───────────────────────────────────────────────────────────
from .site_views import (                                   # noqa: F401
    BimDiscrepancyViewSet,
    BimModelViewSet,
    BoQItemViewSet,
    CalendarEventViewSet,
    ConsultantPaymentViewSet,
    DailyLogViewSet,
    DashboardViewSet,
    DocumentVersionViewSet,
    DroneDatasetViewSet,
    LifecycleViewSet,
    MaterialDeliveryViewSet,
    ProjectApprovalViewSet,
    ProjectDocumentViewSet,
    ProjectMembershipViewSet,
    QualityTestViewSet,
    RequirementWaiverViewSet,
    RfiViewSet,
    RiskViewSet,
    SafetyIncidentViewSet,
    SatelliteDatasetViewSet,
    SubcontractorViewSet,
    TicketCommentViewSet,
    TicketViewSet,
    VariationViewSet,
    WorkOrderViewSet,
    WorkPlanTaskViewSet,
)

# ── Financial, communications & audit ────────────────────────────────────────
from .financial_views import (                              # noqa: F401
    AdminAuditLogViewSet,
    AdvancePaymentViewSet,
    AdvanceRecoveryViewSet,
    CertificateViewSet,
    ChatMessageViewSet,
    ContingencyDrawdownViewSet,
    DisbursementViewSet,
    DrawdownRequestViewSet,
    NotificationViewSet,
    ProvisionalSumViewSet,
    RequisitionViewSet,
)

# ── Procurement & store ───────────────────────────────────────────────────────
from .procurement_views import (                            # noqa: F401
    MaterialRequisitionViewSet,
    PurchaseOrderViewSet,
    StockMovementViewSet,
    StoreItemViewSet,
    StoreSupplierViewSet,
)
