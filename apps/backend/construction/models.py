"""
Sync models.

Design rules driven by the SRS:
  - Each syncable row uses a CLIENT-GENERATED uuid as its primary key
    (WatermelonDB owns ids).
  - created_at / updated_at / deleted_at are BIGINT epoch-MILLISECONDS, stamped
    by the SERVER. We do NOT use MySQL CURRENT_TIMESTAMP: WatermelonDB needs
    millisecond precision and a single monotonic clock, which the sync views
    provide via sync.timestamp.now_ms().
  - Soft delete via deleted_at (tombstone column) so pull can report deletions.
  - Evidence + milestone rows carry submitted_at. Once set, the row is
    IMMUTABLE — the push view refuses to overwrite it (SRS-MOB-OBS-01a / REP-02).
"""
import uuid

from django.db import models


def new_uuid() -> str:
    return str(uuid.uuid4())


class SyncBase(models.Model):
    id = models.CharField(primary_key=True, max_length=36, default=new_uuid, editable=False)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    created_at = models.BigIntegerField(db_index=True)
    updated_at = models.BigIntegerField(db_index=True)
    deleted_at = models.BigIntegerField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class VerifiedModel(models.Model):
    """Mixin for models whose mobile-submitted records need verification before
    they are visible to non-verifier roles. verified_by is set when a verifier
    confirms the record; unverified records are hidden from regular users."""
    verified_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="%(class)s_verified",
    )
    verified_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        abstract = True


class Project(models.Model):
    """The project register (prior-ERP Projects Register). Also holds the site
    location used for evidence geofencing. Admin/PM-managed; pulled read-only by
    mobile clients via GET /projects."""

    STAGES = ["planning", "active", "on_hold", "review_required", "complete", "closed"]
    PROJECT_TYPES = ["standard", "igp", "residential", "commercial", "mixed_use", "infrastructure"]
    CONTRACT_TYPES = ["full", "labor_only", "materials_supply"]

    id = models.CharField(primary_key=True, max_length=36, default=new_uuid, editable=False)
    portfolio_project = models.OneToOneField(
        "properties.Project",
        on_delete=models.PROTECT,
        related_name="construction_profile",
        null=True,
        blank=True,
        help_text="Shared portfolio project represented by this construction workspace.",
    )
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="projects", null=True, blank=True)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=40, blank=True, default="")
    client_name = models.CharField(max_length=200, blank=True, default="")
    location = models.CharField(max_length=200, blank=True, default="")
    # Granular location fields (Section 3 requirement)
    country = models.CharField(max_length=100, blank=True, default="")
    county = models.CharField(max_length=100, blank=True, default="")
    town = models.CharField(max_length=100, blank=True, default="")
    stage = models.CharField(max_length=20, default="active")
    project_type = models.CharField(max_length=30, default="standard")  # expanded types
    description = models.TextField(blank=True, default="")
    modules = models.JSONField(default=list, blank=True)
    onboarding_complete = models.BooleanField(default=False)
    wizard_step = models.PositiveSmallIntegerField(default=1)
    archived = models.BooleanField(default=False)
    created_at = models.BigIntegerField(default=0)
    # Project date fields (Section 3 requirement)
    planned_start_date = models.DateField(null=True, blank=True)
    planned_completion_date = models.DateField(null=True, blank=True)
    # Cost tracking (URS Mobile App, module 5.6.2).
    tender_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0,
                                         help_text="Contract tender / awarded sum")
    budget = models.DecimalField(max_digits=16, decimal_places=2, default=0,
                                  help_text="Approved planned budget (may differ from tender)")
    approved_variations = models.DecimalField(max_digits=16, decimal_places=2, default=0,
                                               help_text="Cached net approved variations (auto-updated)")
    # Geofencing:
    site_latitude = models.FloatField(null=True, blank=True)
    site_longitude = models.FloatField(null=True, blank=True)
    geofence_radius_m = models.PositiveIntegerField(
        null=True, blank=True, help_text="Evidence outside this radius is flagged."
    )

    # IGP-specific fields (Internationally Governed Projects)
    eia_status = models.CharField(max_length=50, blank=True, default="",
                                   help_text="EIA/ESIA status: approved, pending, not_required")
    esmp_exists = models.BooleanField(default=False,
                                       help_text="Environmental & Social Management Plan exists")
    sep_exists = models.BooleanField(default=False,
                                      help_text="Stakeholder Engagement Plan exists")
    grm_contact = models.TextField(blank=True, default="",
                                    help_text="Grievance Redress Mechanism contact details")
    land_acquisition = models.BooleanField(default=False,
                                            help_text="Land acquisition / resettlement applicable")
    procurement_method = models.CharField(max_length=50, blank=True, default="",
                                           help_text="Procurement method: open, restricted, direct")
    procurement_plan_url = models.URLField(max_length=512, blank=True, default="")
    tender_doc_url = models.URLField(max_length=512, blank=True, default="")
    signed_contract_url = models.URLField(max_length=512, blank=True, default="")
    approved_budget = models.DecimalField(max_digits=16, decimal_places=2, default=0,
                                           help_text="IGP approved project budget")
    baseline_boq_ref = models.CharField(max_length=200, blank=True, default="",
                                         help_text="Baseline BoQ reference")
    safeguards_party = models.CharField(max_length=200, blank=True, default="",
                                         help_text="Safeguards responsible party")
    contract_type = models.CharField(max_length=20, choices=[(c, c) for c in CONTRACT_TYPES], default="full",
                                      help_text="full = contractor supplies all; labor_only = owner supplies materials; materials_supply = contractor supplies materials only")
    procurement_oversight = models.CharField(max_length=200, blank=True, default="",
                                              help_text="Procurement oversight role")
    financial_approval = models.CharField(max_length=200, blank=True, default="",
                                           help_text="Financial approval authority")
    audit_role = models.CharField(max_length=200, blank=True, default="",
                                    help_text="Independent monitoring or audit role")

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Project name cannot be empty"})

    def save(self, *args, **kwargs):
        try:
            self.full_clean(exclude=["organization"])
        except Exception:
            pass  # API layer handles validation; save anyway for admin usage
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class ProjectDocument(models.Model):
    """A controlled project document (drawing, contract, permit, report).
    Versions are append-only — uploading a new version never overwrites prior
    ones (documents.version)."""

    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="documents")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    doc_type = models.CharField(max_length=20, default="other")  # drawing|contract|permit|report|other
    title = models.CharField(max_length=200)
    # Document metadata fields (Section 5.1 requirement)
    discipline = models.CharField(max_length=100, blank=True, default="")  # e.g., Architectural, Structural, MEP
    created_at = models.BigIntegerField()

    def __str__(self) -> str:
        return self.title


class DocumentVersion(models.Model):
    document = models.ForeignKey(ProjectDocument, on_delete=models.PROTECT, related_name="versions")
    version = models.PositiveIntegerField()
    remote_url = models.CharField(max_length=512)
    file_format = models.CharField(max_length=16, blank=True, default="")
    uploaded_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="uploaded_versions")
    uploaded_at = models.BigIntegerField()
    # Additional metadata (Section 5.1 requirement)
    revision_number = models.CharField(max_length=50, blank=True, default="")  # e.g., "Rev A", "Rev 1.0"

    class Meta:
        unique_together = ("document", "version")
        ordering = ["-version"]


class ProjectApproval(models.Model):
    """Statutory approval / permit with an expiry the dashboard can flag."""

    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="approvals")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    approval_type = models.CharField(max_length=40)  # e.g. NCA, NEMA, County
    authority = models.CharField(max_length=120)
    reference = models.CharField(max_length=80, blank=True, default="")
    document_url = models.CharField(max_length=512, blank=True, default="")
    status = models.CharField(max_length=16, default="pending")  # pending|approved|rejected|expired
    issued_at = models.BigIntegerField(null=True, blank=True)
    expiry_at = models.BigIntegerField(null=True, blank=True)
    issue_date = models.DateField(null=True, blank=True)


class LifecycleRecord(models.Model):
    """Auditable register item for requirements spanning the full project lifecycle.

    Purpose-specific modules (BoQ, tickets, certificates, etc.) remain the system
    of record for their domains. This register covers the client-approved gaps:
    feasibility/title/contracts, inspections/corrective actions, drawdowns,
    handover/completion and defects-liability closeout.
    """

    STAGES = [
        ("pre_construction", "Pre-construction"),
        ("construction", "Construction"),
        ("monitoring", "Monitoring"),
        ("drawdowns", "Drawdowns"),
        ("practical_completion", "Practical completion"),
        ("defects_liability", "Defects liability"),
    ]
    STATUSES = [
        ("not_started", "Not started"),
        ("draft", "Draft"),
        ("in_progress", "In progress"),
        ("submitted", "Submitted"),
        ("under_review", "Under review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("completed", "Completed"),
        ("closed", "Closed"),
    ]

    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="lifecycle_records")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    stage = models.CharField(max_length=32, choices=STAGES, db_index=True)
    record_type = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=200)
    reference = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=24, choices=STATUSES, default="draft", db_index=True)
    responsible_party = models.CharField(max_length=200, blank=True, default="")
    authority = models.CharField(max_length=200, blank=True, default="")
    amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    document_url = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="created_lifecycle_records")
    reviewed_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_lifecycle_records",
    )
    reviewed_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField(db_index=True)
    updated_at = models.BigIntegerField(db_index=True)

    class Meta:
        ordering = ["stage", "due_date", "-updated_at"]
        indexes = [models.Index(fields=["project", "stage", "record_type"])]

    def __str__(self) -> str:
        return f"{self.get_stage_display()}: {self.title}"


class Device(models.Model):
    """A Clerk's enrolled mobile device and its Ed25519 public key. The matching
    private key is biometric-gated on the device, so a verifiable signature
    proves the enrolled device (and a live biometric) authorised a submission."""

    id = models.CharField(primary_key=True, max_length=64, editable=False)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="devices")
    public_key = models.CharField(max_length=128)  # base64 Ed25519 (32 raw bytes)
    algorithm = models.CharField(max_length=16, default="ed25519")
    enrolled_at = models.BigIntegerField()
    revoked = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.user_id}:{self.id}"


class ProgressPlan(models.Model):
    """Planned baseline for a project's S-curve: the cumulative % expected by the
    end of each ISO week. Admin/workplan-managed reference data (not client-
    writable). Compared against actual submitted progress in /reports/scurve."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project_id = models.CharField(max_length=36, db_index=True)
    week = models.CharField(max_length=8)  # ISO week, e.g. "2026-W02"
    planned_percent = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = ("project_id", "week")
        ordering = ["project_id", "week"]


class MilestoneEntry(SyncBase):
    """SRS-MOB-MILE: milestone progress captured on site. Mobile-authoritative."""

    project_id = models.CharField(max_length=36, db_index=True)
    milestone_id = models.CharField(max_length=255, db_index=True)
    percent_complete = models.PositiveSmallIntegerField()
    submitted_at = models.BigIntegerField(null=True, blank=True)
    # Biometric-bound signature carried with the submission (set on submit):
    client_signature = models.CharField(max_length=128, null=True, blank=True)
    signing_device_id = models.CharField(max_length=64, null=True, blank=True)
    required_evidence_types = models.JSONField(default=list, blank=True)
    required_certifying_role = models.CharField(max_length=40, blank=True, default="")
    payment_instruction = models.CharField(max_length=512, blank=True, default="")
    payment_value = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True, help_text="Monetary value of this milestone for payment triggering")


class EvidenceFile(SyncBase):
    """SRS-MOB-EVID: photo evidence metadata. Bytes live on disk/object storage,
    NOT in this row and NOT in the sync payload — only `remote_url` references it."""

    milestone_entry = models.ForeignKey(
        MilestoneEntry, on_delete=models.PROTECT, db_column="milestone_entry_id", related_name="evidence"
    )
    # photo | 360 | drone | document — the prior ERP captured all of these.
    media_type = models.CharField(max_length=12, default="photo")
    remote_url = models.CharField(max_length=512)
    hash = models.CharField(max_length=64, db_index=True)  # sha256, also idempotency key
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    captured_at = models.BigIntegerField()
    submitted_at = models.BigIntegerField(null=True, blank=True)
    # Server-computed location verification (not client-writable):
    geofence_status = models.CharField(max_length=12, default="unknown")
    distance_m = models.FloatField(null=True, blank=True)


class Observation(SyncBase, VerifiedModel):
    """SRS-MOB-OBS-01/02: short observations from the field, optionally flagged."""

    milestone_entry = models.ForeignKey(
        MilestoneEntry, on_delete=models.PROTECT, db_column="milestone_entry_id", related_name="observations"
    )
    body = models.TextField()
    flag = models.CharField(max_length=12, default="none")  # none | issue | urgent
    origin = models.CharField(max_length=12, default="mobile")


class OfficeNote(SyncBase):
    """SRS-MOB-OBS-01a / REP-02: office notes added via desktop or mobile WITHOUT
    altering submitted evidence. Physically separate table, FK to the evidence —
    there is no code path by which writing here mutates an evidence row."""

    milestone_entry = models.ForeignKey(
        MilestoneEntry, on_delete=models.PROTECT, db_column="milestone_entry_id", related_name="office_notes"
    )
    body = models.TextField()
    author = models.CharField(max_length=120)


class SubmissionRecord(models.Model):
    """Immutable tamper-evidence seal, written once when a milestone is
    submitted. The integrity_hash binds the progress value + all photo hashes +
    observation text (see integrity.compute_integrity_hash). Re-deriving it
    later and comparing detects any post-submission tampering."""

    milestone_entry = models.OneToOneField(
        MilestoneEntry, on_delete=models.PROTECT, db_column="milestone_entry_id", related_name="seal"
    )
    integrity_hash = models.CharField(max_length=64, db_index=True)
    evidence_count = models.PositiveIntegerField(default=0)
    sealed_at = models.BigIntegerField()
    # Digital-signature provenance (filled when a signed submission is sealed):
    signature = models.CharField(max_length=128, null=True, blank=True)
    device_id = models.CharField(max_length=64, null=True, blank=True)
    signature_verified = models.BooleanField(default=False)
    is_primary_progress = models.BooleanField(default=True, help_text="Flagged as primary progress data (Clerk of Works authoritative)")

    def __str__(self) -> str:
        return f"seal({self.milestone_entry_id})={self.integrity_hash[:8]}"


class MilestoneVerification(models.Model):
    """A second-party review of a submitted milestone (SRS audit; prior-ERP
    site.reporting.milestone.verify). The Clerk submits + signs; an engineer/PM
    then verifies or rejects — kept distinct so the same person can't do both."""

    DECISION_CHOICES = [
        ("verified", "Verified"),
        ("rejected", "Rejected"),
        ("request_clarification", "Request Clarification"),
    ]

    milestone_entry = models.OneToOneField(
        MilestoneEntry, on_delete=models.PROTECT, db_column="milestone_entry_id",
        related_name="verification",
    )
    verifier = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="verifications")
    decision = models.CharField(max_length=22, choices=DECISION_CHOICES)  # verified | rejected | request_clarification
    note = models.TextField(blank=True, default="")
    verified_at = models.BigIntegerField()
    signature = models.CharField(max_length=256, blank=True, default="")
    signed_data = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"{self.decision}({self.milestone_entry_id}) by {self.verifier_id}"


class DailyLog(VerifiedModel):
    """Clerk of Works daily site report (site.reporting.daily.manage)."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project_id = models.CharField(max_length=36, db_index=True)
    log_date = models.CharField(max_length=10)  # YYYY-MM-DD
    weather = models.CharField(max_length=40, blank=True, default="")
    labour_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, default="")
    # Structured general-site-condition capture (URS Mobile App, module 1):
    # weather AM/PM, materials, labour adequacy, plant & equipment, visitors,
    # information received. Stored as a JSON section map; the flat columns above
    # stay populated (summary) so existing reports/compliance keep working.
    details = models.JSONField(default=dict, blank=True)
    author = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="daily_logs")
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-log_date", "-created_at"]


class MaterialDelivery(VerifiedModel):
    """Materials delivered to site (SRS-MOB-MAT: weekly report section data).
    Entered by the Clerk; aggregated into the weekly report."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project_id = models.CharField(max_length=36, db_index=True)
    delivery_date = models.CharField(max_length=10)  # YYYY-MM-DD
    material = models.CharField(max_length=120)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, blank=True, default="")
    supplier = models.CharField(max_length=120, blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    # Photo of the delivery note / receipt as proof of delivery. Uploaded via
    # /media/upload (same store as evidence); we keep only the resulting URL.
    receipt_url = models.CharField(max_length=300, blank=True, default="")
    boq_item = models.ForeignKey("construction.BoQItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="material_deliveries")
    received_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, related_name="material_deliveries"
    )
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-delivery_date", "-created_at"]


class SafetyIncident(VerifiedModel):
    """Health & safety incident or near-miss (SRS-MOB-HS: weekly report
    section data). Serious incidents alert the office immediately."""

    SEVERITIES = ["near_miss", "first_aid", "lost_time", "serious"]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project_id = models.CharField(max_length=36, db_index=True)
    incident_date = models.CharField(max_length=10)  # YYYY-MM-DD
    severity = models.CharField(max_length=12, default="near_miss")
    description = models.TextField()
    action_taken = models.TextField(blank=True, default="")
    # Optional incident photos as proof. JSON list of URLs uploaded via
    # /media/upload (same store as evidence); we keep only the URLs.
    photo_urls = models.JSONField(default=list, blank=True)
    reported_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, related_name="safety_incidents"
    )
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-incident_date", "-created_at"]


class Risk(models.Model):
    """Persistent project risk register item with scored likelihood/impact."""
    STATUS_CHOICES = [("open", "Open"), ("in_progress", "In progress"), ("closed", "Closed")]
    project_id = models.CharField(max_length=36, db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="risks", null=True, blank=True)
    reference = models.CharField(max_length=30, blank=True, default="")
    description = models.CharField(max_length=500)
    category = models.CharField(max_length=80, default="General")
    owner = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_risks")
    likelihood = models.PositiveSmallIntegerField(default=3)
    impact = models.PositiveSmallIntegerField(default=3)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="open")
    mitigation = models.TextField(blank=True, default="")
    next_review = models.DateField(null=True, blank=True)
    closed_at = models.BigIntegerField(null=True, blank=True)
    created_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="created_risks")
    created_at = models.BigIntegerField(db_index=True)
    updated_at = models.BigIntegerField(db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def score(self):
        return self.likelihood * self.impact


class Ticket(VerifiedModel):
    """Managed site issue (prior-ERP Tickets/Issues). Can be raised standalone
    or promoted from a field Observation; tracked through to resolution."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project_id = models.CharField(max_length=36, db_index=True)
    milestone_id = models.CharField(max_length=36, blank=True, default="")
    observation_id = models.CharField(max_length=36, blank=True, default="")  # source, if promoted
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    priority = models.CharField(max_length=12, default="normal")  # low|normal|high|urgent
    status = models.CharField(max_length=12, default="open")  # open|in_progress|resolved|closed
    # URS Mobile App, module 4 — risk x sensitivity classification + SLA date,
    # acknowledgement, and escalation level (0 = none, 1 owner, 2 PM, 3 client).
    risk_level = models.CharField(max_length=8, default="medium")  # low|medium|high
    sensitivity = models.CharField(max_length=8, default="normal")  # normal|urgent
    due_date = models.CharField(max_length=10, blank=True, default="")  # YYYY-MM-DD target resolution
    acknowledged_at = models.BigIntegerField(null=True, blank=True)
    escalation_level = models.PositiveSmallIntegerField(default=0)
    raised_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, related_name="raised_tickets"
    )
    # Optional drawing pin (industry pattern: Fieldwire's plan-pinned tasks).
    # Fractions of the drawing's width/height so pins survive any zoom level.
    plan_document = models.ForeignKey(
        ProjectDocument, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="pinned_tickets",
    )
    pin_x = models.FloatField(null=True, blank=True)  # 0..1, left -> right
    pin_y = models.FloatField(null=True, blank=True)  # 0..1, top -> bottom
    assigned_to = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tickets"
    )
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.priority}] {self.title}"


class TicketComment(VerifiedModel):
    """Comment thread on a ticket, with optional file attachment."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="ticket_comments")
    body = models.TextField()
    attachment_url = models.CharField(max_length=512, blank=True, default="")
    attachment_name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"comment({self.ticket_id}) by {self.author_id}"


class RequirementWaiver(models.Model):
    """A waiver exempting a project from a mandatory onboarding requirement.
    Mirrors the prior-ERP project_requirement_waivers table (URS-TEN-03)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="waivers")
    requirement_key = models.CharField(max_length=80)
    requirement_type = models.CharField(max_length=12, default="FIELD")  # FIELD | ROLE | DOC | APPROVAL
    reason = models.TextField()
    waived_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="waivers_granted"
    )
    waived_at = models.BigIntegerField()

    class Meta:
        unique_together = ("project", "requirement_key")

    def __str__(self) -> str:
        return f"waive({self.project_id}:{self.requirement_key})"


class ProjectModule(models.Model):
    """Tracks module-level settings per project (e.g., tolerance thresholds).
    This enables the configurable tolerance thresholds for risk/payment."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="module_configs")
    module_key = models.CharField(max_length=40)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("project", "module_key")

    def __str__(self) -> str:
        return f"{self.project_id}:{self.module_key}"


class IgpSafeguard(models.Model):
    """IGP-specific Environmental & Social Safeguards (World Bank, AfDB, etc.)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="igp_safeguards")
    risk_classification = models.CharField(max_length=20, default="not_classified")
    eia_status = models.CharField(max_length=20, default="not_submitted")
    esia_document_url = models.CharField(max_length=512, blank=True, default="")
    esmp_url = models.CharField(max_length=512, blank=True, default="")
    stakeholder_plan_url = models.CharField(max_length=512, blank=True, default="")
    grievance_mechanism_url = models.CharField(max_length=512, blank=True, default="")
    land_acquisition_status = models.CharField(max_length=40, blank=True, default="")
    updated_at = models.BigIntegerField(default=0)

    def __str__(self) -> str:
        return f"IGP-safeguard({self.project_id})"


class IgpProcurement(models.Model):
    """IGP-specific procurement and fiduciary requirements."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="igp_procurement")
    procurement_method = models.CharField(max_length=60, blank=True, default="")
    procurement_plan_url = models.CharField(max_length=512, blank=True, default="")
    tender_document_url = models.CharField(max_length=512, blank=True, default="")
    signed_contract_url = models.CharField(max_length=512, blank=True, default="")
    approved_budget_url = models.CharField(max_length=512, blank=True, default="")
    baseline_boq_url = models.CharField(max_length=512, blank=True, default="")
    updated_at = models.BigIntegerField(default=0)

    def __str__(self) -> str:
        return f"IGP-procurement({self.project_id})"


class QualityTest(VerifiedModel):
    """Quality control test results (concrete cube tests, materials testing,
    soil compaction, etc.). Mirrors the Clerk of Works weekly report format."""

    TEST_TYPES = ["concrete_cube", "soil_compaction", "steel_tensile", "material", "other"]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="quality_tests")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    test_type = models.CharField(max_length=30, default="concrete_cube")
    sample_id = models.CharField(max_length=80)
    location = models.CharField(max_length=200, blank=True, default="")
    grade = models.CharField(max_length=40, blank=True, default="")
    test_date = models.CharField(max_length=10)  # YYYY-MM-DD
    result_date = models.CharField(max_length=10, blank=True, default="")
    result_value = models.CharField(max_length=80, blank=True, default="")
    passed = models.BooleanField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    tested_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="quality_tests"
    )
    photo_urls = models.JSONField(default=list, blank=True)  # array of photo URLs
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-test_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.test_type}:{self.sample_id}"


class ConsultantPayment(models.Model):
    """Consultant payment management. Tracks payment certificates, retentions,
    and disbursements for consultants (architects, engineers, QS, etc.)."""

    STATUSES = ["pending", "approved", "paid", "void"]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="consultant_payments", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    consultant_name = models.CharField(max_length=200)
    consultant_role = models.CharField(max_length=60)  # architect|engineer|qs|other
    certificate_number = models.CharField(max_length=40)
    approved_fee = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    retention_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=12, default="pending")
    invoice_url = models.CharField(max_length=512, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_consultant_payments"
    )
    paid_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status"], name="idx_cnslt_prj_status"),
        ]

    def __str__(self) -> str:
        return f"{self.consultant_name}:{self.certificate_number}"


class DroneDataset(models.Model):
    """Drone/satellite dataset metadata. Full data lives externally; this is
    the reference, compliance declaration, and linkage to projects/milestones
    (SRS-DRN-01 through SRS-DRN-10)."""

    DATA_TYPES = ["image", "video", "orthomosaic", "point_cloud", "3d_model", "measurement"]
    REVIEW_STATUSES = ["pending", "under_review", "reviewed", "linked", "archived"]
    STORAGE_TIERS = ["hot", "external", "cold"]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="drone_datasets")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    data_type = models.CharField(max_length=20, default="image")
    operator_id = models.CharField(max_length=80, blank=True, default="")
    flight_date = models.CharField(max_length=10)  # YYYY-MM-DD
    classification = models.CharField(max_length=40, blank=True, default="informational")  # informational|verification|measurement
    external_url = models.CharField(max_length=512)
    thumbnail_url = models.CharField(max_length=512, blank=True, default="")
    file_hash = models.CharField(max_length=64, blank=True, default="")
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    compliance_declared = models.BooleanField(default=False)
    milestone_id = models.CharField(max_length=36, blank=True, default="")
    uploaded_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    uploaded_at = models.BigIntegerField()
    is_archived = models.BooleanField(default=False)

    # SRS-DRN-FUNC-03: Key output URLs (thumbnails / stills / orthomosaics)
    key_outputs = models.JSONField(default=dict, blank=True)

    # SRS-DRN-REV-*: Review workflow status
    review_status = models.CharField(max_length=20, default="pending")
    reviewed_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="drone_reviews"
    )
    reviewed_at = models.BigIntegerField(null=True, blank=True)

    # SRS-DRN-LINK-04: Sales & Marketing linkage
    sales_campaign_id = models.CharField(max_length=80, blank=True, default="")

    # SRS-DRN-RET-*: Storage tier & retention
    storage_tier = models.CharField(max_length=12, default="hot")

    # SRS-DRN-SEC-03: Signed URL expiry tracking
    signed_url_expires_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-flight_date", "-uploaded_at"]

    def __str__(self) -> str:
        return f"drone:{self.data_type}({self.project_id})"


class DroneDatasetReview(models.Model):
    """SRS-DRN-REV-01/02: Human review & annotation of drone datasets."""

    ANNOTATION_TYPES = ["general", "structural", "compliance", "measurement"]

    dataset = models.ForeignKey(DroneDataset, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="drone_annotations")
    annotation = models.TextField()
    annotation_type = models.CharField(max_length=20, default="general")
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"review:{self.dataset_id}({self.annotation_type})"


class SatelliteDataset(models.Model):
    """Satellite imagery dataset for independent site verification."""
    SAT_TYPES = ["optical", "sar", "multispectral", "thermal"]

    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="satellite_datasets")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    sat_type = models.CharField(max_length=20, default="optical")
    capture_date = models.CharField(max_length=10)  # YYYY-MM-DD
    resolution_cm = models.PositiveIntegerField(null=True, blank=True, help_text="Resolution in cm per pixel")
    cloud_cover_pct = models.FloatField(null=True, blank=True)
    external_url = models.CharField(max_length=512, blank=True, default="")
    thumbnail_url = models.CharField(max_length=512, blank=True, default="")
    source_provider = models.CharField(max_length=100, blank=True, default="")
    license_type = models.CharField(max_length=40, blank=True, default="")
    milestone_id = models.CharField(max_length=36, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.BigIntegerField()

    class Meta:
        ordering = ["-capture_date"]

    def __str__(self) -> str:
        return f"satellite:{self.sat_type}({self.project_id})"


class WorkPlanTask(models.Model):
    """A task extracted from a work-plan / programme-of-works Excel file.
    Captures all columns from standard work plan formats including VertexMandera.
    Used to auto-generate weekly milestone entries so the COW only fills progress."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="work_plan_tasks", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    task_id = models.CharField(max_length=20)
    task_name = models.CharField(max_length=500)
    # WBS hierarchy levels (columns B-G in VertexMandera format)
    wbs_level = models.IntegerField(default=0, help_text="0=Level 1 (col B), 5=Level 6 (col G)")
    level1_name = models.CharField(max_length=200, blank=True, default="")
    level2_name = models.CharField(max_length=200, blank=True, default="")
    level3_name = models.CharField(max_length=200, blank=True, default="")
    level4_name = models.CharField(max_length=200, blank=True, default="")
    level5_name = models.CharField(max_length=200, blank=True, default="")
    level6_name = models.CharField(max_length=200, blank=True, default="")
    # Schedule
    start_date = models.DateField()
    end_date = models.DateField()
    duration_days = models.PositiveIntegerField(default=0)
    predecessors = models.CharField(max_length=200, blank=True, default="")
    # Resources & responsibility
    resource = models.CharField(max_length=200, blank=True, default="")
    responsible_party = models.CharField(max_length=200, blank=True, default="")
    # Progress tracking
    percent_complete = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    status = models.CharField(max_length=20, blank=True, default="")
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)
    # Ingestion approval: draft tasks from Excel must be reviewed and approved
    approval_status = models.CharField(max_length=12, choices=[
        ("draft", "Draft"), ("approved", "Approved"), ("rejected", "Rejected"),
    ], default="draft")
    approved_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, null=True, blank=True, related_name="approved_workplan_tasks")
    approved_at = models.BigIntegerField(null=True, blank=True)
    # Additional
    remarks = models.TextField(blank=True, default="")
    baseline_days = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["start_date", "task_id"]
        unique_together = [("project", "task_id")]

    def __str__(self) -> str:
        return f"{self.task_id}: {self.task_name}"


class BoQItem(models.Model):
    """A line item from a Bill of Quantities Excel file, keyed by project."""

    SECTION_CHOICES = [
        "preliminaries", "substructure", "superstructure", "finishes",
        "mep", "external", "general",
    ]

    COST_STATE_CHOICES = [
        ("budgeted", "Budgeted"),
        ("ascertained", "Ascertained"),
        ("committed", "Committed"),
        ("certified", "Certified"),
        ("paid", "Paid"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="boq_items", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    section = models.CharField(max_length=30, default="general")
    item_number = models.CharField(max_length=20, blank=True, default="")
    description = models.CharField(max_length=300)
    unit = models.CharField(max_length=20, blank=True, default="")
    quantity = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    rate = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    # Ingestion approval: draft items from Excel must be reviewed and approved by QS
    approval_status = models.CharField(max_length=12, choices=[
        ("draft", "Draft"), ("approved", "Approved"), ("rejected", "Rejected"),
    ], default="draft")
    approved_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, null=True, blank=True, related_name="approved_boq_items")
    approved_at = models.BigIntegerField(null=True, blank=True)
    # Cost tracking state machine: budgeted -> ascertained -> committed -> certified -> paid
    cost_state = models.CharField(max_length=14, choices=COST_STATE_CHOICES, default="budgeted")
    certified_quantity = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    certified_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    # Mobile BoQ field progress (Clerk of Works)
    executed_quantity = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True, default=0)
    progress_updated_at = models.BigIntegerField(null=True, blank=True, default=0)
    progress_updated_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["section", "item_number"]
        unique_together = [("project", "section", "item_number")]

    def __str__(self) -> str:
        return f"{self.section}/{self.item_number}: {self.description[:40]}"


# ── Construction Cost Management ───────────────────────────────────────────────

class ProjectMembership(models.Model):
    """Links a user to a project with a specific role.
    Controls which projects a user can see and what they can do."""

    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="project_memberships")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    role = models.ForeignKey("organizations.Role", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    label = models.CharField(max_length=100, blank=True, default="", help_text="Free-text label (e.g. 'Site Supervisor')")
    created_at = models.BigIntegerField()

    class Meta:
        unique_together = ("user", "project")
        ordering = ["project__name", "user__username"]

    def __str__(self) -> str:
        return f"{self.user_id} → {self.project_id}"


class RecordSequence(models.Model):
    """Organization/project-scoped counter for human-readable, audit-safe references."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="record_sequences", null=True, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="record_sequences", null=True, blank=True)
    record_type = models.CharField(max_length=40)
    prefix = models.CharField(max_length=20)
    next_value = models.PositiveBigIntegerField(default=1)
    updated_at = models.BigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organization", "project", "record_type"], name="uniq_record_sequence_scope"),
        ]


class Variation(models.Model):
    """A contract variation / change order (addition, omission, or admin item).
    Tracks the full lifecycle from draft through approval."""
    VARIATION_TYPES = [
        ("addition", "Addition"),
        ("omission", "Omission"),
        ("administrative", "Administrative"),
    ]
    STATUSES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    TARGETS = [
        ("boq", "Bill of Quantities"),
        ("work_plan", "Work Plan"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="variations", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    variation_number = models.CharField(max_length=30)
    description = models.TextField()
    variation_type = models.CharField(max_length=20, choices=VARIATION_TYPES, default="addition")
    target = models.CharField(max_length=20, choices=TARGETS, default="boq")
    quantity = models.DecimalField(max_digits=16, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=30, blank=True, default="")
    unit_rate = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    status = models.CharField(max_length=12, choices=STATUSES, default="draft")
    justification = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("project", "variation_number")]
        indexes = [
            models.Index(fields=["project", "status"], name="idx_var_prj_status"),
            models.Index(fields=["project", "status", "variation_type"], name="idx_var_prj_stat_type"),
        ]

    def __str__(self) -> str:
        return f"{self.variation_number}: {self.description[:50]}"


class ProvisionalSum(models.Model):
    """A provisional sum item in the contract — progressively ascertained
    as design matures or actual costs become known."""
    STATUSES = [
        ("pending", "Pending"),
        ("ascertained", "Ascertained"),
        ("closed", "Closed"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="provisional_sums", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    item_number = models.CharField(max_length=20)
    description = models.CharField(max_length=300)
    budgeted_amount = models.DecimalField(max_digits=16, decimal_places=2)
    ascertained_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=STATUSES, default="pending")
    notes = models.TextField(blank=True, default="")
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["item_number"]
        unique_together = [("project", "item_number")]
        indexes = [
            models.Index(fields=["project", "status"], name="idx_ps_prj_status"),
        ]

    def __str__(self) -> str:
        return f"PS-{self.item_number}: {self.description[:40]}"


class ContingencyDrawdown(models.Model):
    """A drawdown request against the project contingency allowance.
    Requires approval before funds are released."""
    CATEGORIES = [
        ("design_development", "Design Development"),
        ("unforeseen", "Unforeseen Condition"),
        ("escalation", "Price Escalation"),
        ("client_instruction", "Client Instruction"),
        ("other", "Other"),
    ]
    STATUSES = [
        ("requested", "Requested"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="contingency_drawdowns", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    drawdown_number = models.CharField(max_length=30)
    reason = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORIES, default="unforeseen")
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    status = models.CharField(max_length=12, choices=STATUSES, default="requested")
    approved_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("project", "drawdown_number")]
        indexes = [
            models.Index(fields=["project", "status"], name="idx_cnt_prj_status"),
        ]

    def __str__(self) -> str:
        return f"CD-{self.drawdown_number}: {self.amount} ({self.status})"


class AdvancePayment(models.Model):
    """An advance/mobilisation payment made to a contractor, with
    automatic recovery from subsequent certificates."""
    STATUSES = [
        ("active", "Active"),
        ("fully_recovered", "Fully Recovered"),
        ("defaulted", "Defaulted"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="advance_payments", db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    contractor_name = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    recovery_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10,
                                         help_text="Percentage recovered per certificate")
    recovered_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=STATUSES, default="active")
    notes = models.TextField(blank=True, default="")
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status"], name="idx_adv_prj_status"),
        ]

    def __str__(self) -> str:
        return f"AP-{self.contractor_name}: {self.amount}"


class AdvanceRecovery(models.Model):
    """Records a single recovery event against an AdvancePayment, typically
    linked to an Interim Payment Certificate (IPC)."""
    advance_payment = models.ForeignKey(AdvancePayment, on_delete=models.CASCADE, related_name="recoveries")
    certificate_number = models.CharField(max_length=40, blank=True, default="")
    amount_recovered = models.DecimalField(max_digits=16, decimal_places=2)
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Recovery {self.amount_recovered} on {self.advance_payment}"


# ── Subcontractors & Work Orders ───────────────────────────────────────────

class Subcontractor(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="subcontractors")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="construction_subcontractors", null=True, blank=True)
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=200, blank=True, default="")
    email = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    created_at = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [("project", "name")]

    def __str__(self) -> str:
        return self.name


class WorkOrder(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("issued", "Issued"),
        ("completed", "Completed"),
        ("closed", "Closed"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="work_orders")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="construction_work_orders", null=True, blank=True)
    subcontractor = models.ForeignKey(Subcontractor, on_delete=models.CASCADE, related_name="work_orders")
    order_number = models.CharField(max_length=40)
    boq_section = models.CharField(max_length=30)
    description = models.TextField(blank=True, default="")
    unit_rate = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    quantity_cap = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    total_value = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="draft")
    issued_date = models.CharField(max_length=10, blank=True, default="")
    completed_date = models.CharField(max_length=10, blank=True, default="")
    certified_quantity = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    certified_value = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    paid_value = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    created_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True)
    created_at = models.BigIntegerField(default=0)
    updated_at = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [("project", "order_number")]

    def __str__(self) -> str:
        return f"{self.order_number} - {self.subcontractor.name}"


# ── Admin Audit Log ────────────────────────────────────────────────────────

class AdminAuditLog(models.Model):
    """Comprehensive audit log for admin actions and system events.

    Records user interactions with sensitive operations like:
    - System settings changes
    - User/role/organizations management
    - Permission assignments
    - Configuration/modification
    - Import/export operations
    - Payment/verified record modifications
    """

    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="+", null=True, blank=True)
    timestamp = models.BigIntegerField()
    user = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="admin_audit_logs", null=True, blank=True)
    user_role = models.CharField(max_length=100, blank=True, default="")

    action = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=[
        ("system", "System Configuration"),
        ("users", "User Management"),
        ("organizations", "Organization Management"),
        ("permissions", "Permissions & Roles"),
        ("data", "Data Operations"),
        ("financial", "Financial Records"),
        ("certificates", "Certificates"),
        ("exports", "Reports & Exports"),
    ], default="system")

    resource = models.CharField(max_length=100, blank=True, default="")
    resource_id = models.CharField(max_length=36, blank=True, default="")

    details = models.JSONField(default=dict, blank=True)

    ip_address = models.CharField(max_length=45, blank=True, default="")
    user_agent = models.CharField(max_length=512, blank=True, default="")

    before_state = models.JSONField(default=dict, blank=True, help_text="State before the change")
    after_state = models.JSONField(default=dict, blank=True, help_text="State after the change")

    outcome = models.CharField(max_length=20, choices=[
        ("success", "Success"),
        ("error", "Error"),
        ("blocked", "Blocked"),
        ("partial", "Partial"),
    ], default="success")

    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["category"]),
            models.Index(fields=["action"]),
            models.Index(fields=["resource"]),
            models.Index(fields=["timestamp"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return f"{self.timestamp} — {self.user.username if self.user else 'system'} — {self.action}"


class DroneAuditLog(models.Model):
    dataset = models.ForeignKey("DroneDataset", on_delete=models.CASCADE, related_name="audit_logs")
    created_at = models.BigIntegerField()
    user = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="drone_audit_logs", null=True, blank=True)
    action = models.CharField(max_length=50)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"DroneAuditLog {self.action} by {self.user.username if self.user else 'system'} at {self.created_at}"


# ── BIM models ────────────────────────────────────────────────────────────

class BimModel(models.Model):
    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="bim_models")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    name = models.CharField(max_length=200)
    discipline = models.CharField(max_length=20, default="architectural")
    file_format = models.CharField(max_length=10, default="ifc")
    version = models.CharField(max_length=20, blank=True, default="")
    remote_url = models.CharField(max_length=512, blank=True, default="")
    file_path = models.CharField(max_length=512, blank=True, default="")
    file_size = models.BigIntegerField(null=True, blank=True)
    is_current = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="uploaded_bim_models", null=True)
    uploaded_at = models.BigIntegerField()
    processing_status = models.CharField(max_length=20, default="pending")
    processing_error = models.TextField(blank=True, default="")
    element_count = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.BigIntegerField(default=0)
    updated_at = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["project", "discipline"]),
            models.Index(fields=["project", "is_current"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.discipline})"


class BimBoqLink(models.Model):
    """Links an IFC element (by its GlobalId) to a BoQ item for the 3D viewer."""
    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="bim_boq_links")
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="boq_links", null=True, blank=True)
    ifc_guid = models.CharField(max_length=64, db_index=True)
    ifc_type = models.CharField(max_length=64, blank=True, default="")
    boq_item = models.ForeignKey("BoQItem", on_delete=models.CASCADE, related_name="bim_links")
    section = models.CharField(max_length=30, blank=True, default="")
    created_at = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["section", "ifc_type"]
        indexes = [
            models.Index(fields=["project", "ifc_guid"]),
            models.Index(fields=["project", "bim_model"]),
        ]
        unique_together = [("project", "ifc_guid", "boq_item")]

    def __str__(self):
        return f"{self.ifc_type}:{self.ifc_guid[:12]} → {self.boq_item_id}"


class BimMilestoneMapping(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="bim_mappings")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="milestone_mappings")
    milestone_entry = models.ForeignKey(
        "construction.MilestoneEntry", on_delete=models.CASCADE, null=True, blank=True,
        db_column="milestone_entry_id", related_name="bim_mappings"
    )
    milestone_ref = models.CharField(max_length=36, blank=True, default="", help_text="Legacy string-based milestone ID")
    element_ids = models.JSONField(default=list)
    color = models.CharField(max_length=20, blank=True, default="#00ff00")
    transparency = models.FloatField(default=0.0)
    created_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="bim_mappings", null=True)
    created_at = models.BigIntegerField()

    class Meta:
        unique_together = ("bim_model", "milestone_ref")
        ordering = ["milestone_ref"]

    def __str__(self):
        return f"{self.bim_model.name} → {self.milestone_ref or self.milestone_entry_id or '?'}"


class BimDiscrepancy(models.Model):
    id = models.CharField(primary_key=True, max_length=36)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="bim_discrepancies")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="discrepancies", null=True, blank=True)
    milestone_entry = models.ForeignKey(
        "construction.MilestoneEntry", on_delete=models.CASCADE, null=True, blank=True,
        db_column="disc_milestone_entry_id", related_name="discrepancies"
    )
    milestone_ref = models.CharField(max_length=36, blank=True, default="", help_text="Legacy string-based milestone ID")
    description = models.TextField()
    severity = models.CharField(max_length=10, default="medium")
    status = models.CharField(max_length=20, default="open")
    confidence_score = models.PositiveSmallIntegerField(null=True, blank=True)
    related_evidence_ids = models.JSONField(default=list)
    resolved_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="resolved_discrepancies", null=True, blank=True)
    resolved_at = models.BigIntegerField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, default="")
    created_at = models.BigIntegerField(default=0)
    updated_at = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-severity", "-created_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "severity"]),
        ]

    def __str__(self):
        return f"{self.severity}: {self.description[:50]}"


# ── Calendar Events ──────────────────────────────────────────────────────

class CalendarEvent(models.Model):
    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="calendar_events", null=True, blank=True)
    milestone_id = models.CharField(max_length=36, blank=True, default="")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    event_type = models.CharField(max_length=20, default="meeting", choices=[
        ("meeting", "Meeting"), ("site_visit", "Site Visit"),
        ("inspection", "Inspection"), ("task", "Task"), ("deadline", "Deadline"),
    ])
    location = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(max_length=20, default="scheduled", choices=[
        ("scheduled", "Scheduled"), ("completed", "Completed"),
        ("cancelled", "Cancelled"), ("overdue", "Overdue"),
    ])
    attendees = models.JSONField(default=list, blank=True)
    findings = models.TextField(blank=True, default="")
    action_items = models.JSONField(default=list, blank=True)
    minutes_url = models.CharField(max_length=512, blank=True, default="")
    start = models.BigIntegerField()
    end = models.BigIntegerField()
    all_day = models.BooleanField(default=False)
    color = models.CharField(max_length=20, blank=True, default="#d92d2d")
    created_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="calendar_events", null=True, blank=True)
    created_at = models.BigIntegerField(default=0)
    updated_at = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["start"]
        indexes = [
            models.Index(fields=["start", "end"]),
            models.Index(fields=["project"]),
            models.Index(fields=["event_type", "status"]),
        ]

    def __str__(self):
        return self.title


# ── Chat Messages ────────────────────────────────────────────────────────

class ChatMessage(models.Model):
    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="chat_messages", null=True, blank=True)
    sender = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="sent_messages")
    recipient = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="received_messages", null=True, blank=True)
    channel = models.CharField(max_length=100, blank=True, default="", help_text="Project-wide or topic channel name")
    body = models.TextField()
    attachment_url = models.CharField(max_length=512, blank=True, default="")
    attachment_name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.BigIntegerField()
    read_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["sender"]),
            models.Index(fields=["recipient"]),
            models.Index(fields=["channel"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.sender_id}: {self.body[:50]}"


# ── Guided Tour Progress ────────────────────────────────────────────────

class TourProgress(models.Model):
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="tour_progress")
    role = models.CharField(max_length=50)
    completed = models.BooleanField(default=False)
    completed_at = models.BigIntegerField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "role")]

    def __str__(self):
        return f"{self.user.username}/{self.role}: {'completed' if self.completed else 'incomplete'}"


# ── RFI (Request for Information) ───────────────────────────────────────

class Rfi(models.Model):
    """Request for Information — formal query between contractor and consultant."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("open", "Open"),
        ("answered", "Answered"),
        ("closed", "Closed"),
        ("void", "Void"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="rfis")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    number = models.CharField(max_length=40, blank=True, default="")
    title = models.CharField(max_length=200)
    question = models.TextField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="open")
    priority = models.CharField(max_length=12, choices=PRIORITY_CHOICES, default="normal")
    category = models.CharField(max_length=40, blank=True, default="")
    # Who raised it
    raised_by = models.ForeignKey("auth.User", on_delete=models.PROTECT, related_name="raised_rfis")
    # Who should answer (optional — assigned to a role or person)
    assigned_to = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_rfis")
    # The consultant's answer
    response = models.TextField(blank=True, default="")
    responded_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="responded_rfis")
    responded_at = models.BigIntegerField(null=True, blank=True)
    # Dates
    due_date = models.CharField(max_length=20, blank=True, default="")
    closed_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "priority"]),
        ]

    def __str__(self) -> str:
        return f"{self.number or 'RFI'} — {self.title[:40]}"


# ── In-App Notifications ─────────────────────────────────────────────────

class Notification(models.Model):
    TYPE_CHOICES = [
        ("incident", "H&S Incident"),
        ("ticket", "Ticket"),
        ("regression", "Milestone Regression"),
        ("escalation", "Escalation"),
        ("system", "System"),
    ]

    id = models.CharField(primary_key=True, max_length=36, default=new_uuid)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="+", null=True, blank=True)
    recipient = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="system")
    link = models.CharField(max_length=512, blank=True, default="")
    read_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.BigIntegerField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title[:60]}"
