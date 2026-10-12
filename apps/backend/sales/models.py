from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrganizationOwnedModel


class SaleListing(OrganizationOwnedModel):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        RESERVED = 'reserved', 'Reserved'
        SOLD = 'sold', 'Sold'
        BLOCKED = 'blocked', 'Blocked'

    unit = models.OneToOneField('properties.Unit', on_delete=models.PROTECT, related_name='sale_listing')
    project = models.ForeignKey('properties.Project', on_delete=models.PROTECT, related_name='sale_listings')
    list_price = models.DecimalField(max_digits=16, decimal_places=2)
    minimum_deposit_percent = models.DecimalField(max_digits=6, decimal_places=2, default=10)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)
    construction_progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    reservation_expires_at = models.DateTimeField(null=True, blank=True)
    is_featured = models.BooleanField(default=False, help_text='Featured listings pin to the top of the public storefront.')

    class Meta:
        ordering = ('project__name', 'unit__code')

    def clean(self):
        if self.unit_id and self.unit.organization_id != self.organization_id:
            raise ValidationError('Sales unit must belong to the same organization.')
        if self.project_id and self.project.organization_id != self.organization_id:
            raise ValidationError('Sales project must belong to the same organization.')
        if self.unit_id and self.project_id and self.project.property_id and self.unit.property_id != self.project.property_id:
            raise ValidationError('The unit must belong to the project property.')
        if self.list_price <= 0:
            raise ValidationError({'list_price': 'List price must be greater than zero.'})
        if not 0 <= self.minimum_deposit_percent <= 100 or not 0 <= self.construction_progress <= 100:
            raise ValidationError('Deposit percentage and construction progress must be between 0 and 100.')


class Buyer(OrganizationOwnedModel):
    class Status(models.TextChoices):
        LEAD = 'lead', 'Lead'
        QUALIFIED = 'qualified', 'Qualified'
        ACTIVE = 'active', 'Active buyer'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    reference = models.CharField(max_length=50)
    full_name = models.CharField(max_length=180)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=40)
    id_number = models.CharField(max_length=60, blank=True, default='')
    tax_number = models.CharField(max_length=60, blank=True)
    address = models.TextField(blank=True)
    financing_type = models.CharField(max_length=30, choices=(('self', 'Self-financed'), ('bank', 'Bank-financed')), default='self')
    financier = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.LEAD)
    assigned_agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='assigned_sales_buyers', null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ('full_name',)
        constraints = [
            models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_buyer_ref'),
            models.UniqueConstraint(fields=('organization', 'id_number'), name='unique_organization_buyer_id'),
        ]


class PropertySale(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        RESERVED = 'reserved', 'Reserved'
        CONTRACTED = 'contracted', 'Contracted'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    reference = models.CharField(max_length=60)
    buyer = models.ForeignKey(Buyer, on_delete=models.PROTECT, related_name='sales')
    listing = models.ForeignKey(SaleListing, on_delete=models.PROTECT, related_name='sales')
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='property_sales', null=True, blank=True)
    agreed_price = models.DecimalField(max_digits=16, decimal_places=2)
    reservation_fee = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    reserved_at = models.DateTimeField(null=True, blank=True)
    contracted_on = models.DateField(null=True, blank=True)
    expected_completion_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_sale_ref')]

    def clean(self):
        if self.buyer_id and self.buyer.organization_id != self.organization_id:
            raise ValidationError('Buyer must belong to the same organization.')
        if self.listing_id and self.listing.organization_id != self.organization_id:
            raise ValidationError('Listing must belong to the same organization.')
        if self.agreed_price <= 0 or self.reservation_fee < 0:
            raise ValidationError('Sale price must be positive and reservation fee cannot be negative.')


class Installment(OrganizationOwnedModel):
    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        DUE = 'due', 'Due'
        PARTIAL = 'partial', 'Partially paid'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'

    sale = models.ForeignKey(PropertySale, on_delete=models.CASCADE, related_name='installments')
    sequence = models.PositiveSmallIntegerField()
    description = models.CharField(max_length=180)
    due_on = models.DateField()
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPCOMING)
    milestone = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ('due_on',)
        constraints = [models.UniqueConstraint(fields=('sale', 'sequence'), name='unique_sale_installment_sequence')]

    def clean(self):
        if self.sale_id and self.sale.organization_id != self.organization_id:
            raise ValidationError('Installment must belong to the sale organization.')
        if self.amount <= 0 or self.paid_amount < 0 or self.paid_amount > self.amount:
            raise ValidationError('Installment amounts are invalid.')


class SalePayment(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending verification'
        VERIFIED = 'verified', 'Verified'
        PARTIAL = 'partial', 'Partially allocated'
        REJECTED = 'rejected', 'Rejected'
        REVERSED = 'reversed', 'Reversed'

    reference = models.CharField(max_length=80)
    sale = models.ForeignKey(PropertySale, on_delete=models.PROTECT, related_name='payments')
    installment = models.ForeignKey(Installment, on_delete=models.SET_NULL, related_name='payments', null=True, blank=True)
    paid_on = models.DateField()
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    method = models.CharField(max_length=30, choices=(('online', 'Online'), ('bank', 'Bank transfer'), ('paybill', 'Paybill'), ('cheque', 'Cheque')))
    external_reference = models.CharField(max_length=120)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='verified_sale_payments', null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ('-paid_on',)
        constraints = [
            models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_sale_payment_ref'),
            models.UniqueConstraint(fields=('organization', 'external_reference'), name='unique_organization_external_payment_ref'),
        ]

    def clean(self):
        if self.sale_id and self.sale.organization_id != self.organization_id:
            raise ValidationError('Payment sale must belong to the same organization.')
        if self.installment_id and self.installment.organization_id != self.organization_id:
            raise ValidationError('Payment installment must belong to the same organization.')
        if self.installment_id and self.sale_id and self.installment.sale_id != self.sale_id:
            raise ValidationError({'installment': 'Installment must belong to the selected sale.'})
        if self.amount <= 0:
            raise ValidationError({'amount': 'Payment amount must be greater than zero.'})


class ListingRender(OrganizationOwnedModel):
    """Media assets showcased for a sale listing.

    ``render_kind`` distinguishes a 3D model (GLB/GLTF), a photoreal render or
    a floor-plan image. The 3D model is loaded in-browser with three.js, while
    stills are displayed in a gallery carousel. A listing may own many renders.
    """

    class RenderKind(models.TextChoices):
        MODEL_3D = 'model_3d', '3D model (GLB/GLTF)'
        RENDER = 'render', 'Photoreal render'
        FLOORPLAN = 'floorplan', 'Floor plan'

    listing = models.ForeignKey(SaleListing, on_delete=models.CASCADE, related_name='renders')
    render_kind = models.CharField(max_length=16, choices=RenderKind.choices, default=RenderKind.RENDER)
    title = models.CharField(max_length=160, blank=True)
    caption = models.CharField(max_length=240, blank=True)
    file = models.FileField(upload_to='sales/renderings/%Y/%m/', blank=True)
    file_url = models.URLField(max_length=512, blank=True)
    mime_type = models.CharField(max_length=80, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('sort_order', '-created_at')

    def clean(self):
        if self.listing_id and self.listing.organization_id != self.organization_id:
            raise ValidationError('Render listing must belong to the same organization.')
        if self.render_kind == self.RenderKind.MODEL_3D:
            extension = (self.file.name or '').lower().rsplit('.', 1)[-1]
            if self.file and extension not in ('glb', 'gltf'):
                raise ValidationError({'file': '3D models must be .glb or .gltf files.'})


class BuyerPortalAccess(OrganizationOwnedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sales_buyer_portal_accesses')
    buyer = models.ForeignKey(Buyer, on_delete=models.CASCADE, related_name='portal_accesses')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('buyer__full_name', 'user__username')
        constraints = [
            models.UniqueConstraint(fields=('organization', 'user'), name='unique_organization_buyer_portal_user'),
        ]

    def clean(self):
        if self.buyer_id and self.buyer.organization_id != self.organization_id:
            raise ValidationError('Portal buyer must belong to the same organization.')
        if self.user_id and self.organization_id:
            from organizations.models import Membership
            if not Membership.objects.active().filter(user_id=self.user_id, organization_id=self.organization_id).exists():
                raise ValidationError('Portal user must be an active organization member.')


class SiteVisit(OrganizationOwnedModel):
    reference = models.CharField(max_length=60)
    visitor_name = models.CharField(max_length=180)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40)
    project = models.ForeignKey('properties.Project', on_delete=models.PROTECT, related_name='site_visits')
    interested_unit_type = models.CharField(max_length=80, blank=True)
    introducing_agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='introduced_site_visits', null=True, blank=True)
    visited_at = models.DateTimeField()
    follow_up_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    converted_buyer = models.ForeignKey(Buyer, on_delete=models.SET_NULL, related_name='site_visits', null=True, blank=True)

    class Meta:
        ordering = ('-visited_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_visit_ref')]


class AgentCommission(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending eligibility'
        ELIGIBLE = 'eligible', 'Eligible'
        APPROVED = 'approved', 'Approved'
        PAID = 'paid', 'Paid'
        HELD = 'held', 'Held'

    reference = models.CharField(max_length=60)
    sale = models.ForeignKey(PropertySale, on_delete=models.PROTECT, related_name='commissions')
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sales_commissions')
    rate_percent = models.DecimalField(max_digits=6, decimal_places=2)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    required_paid_percent = models.DecimalField(max_digits=6, decimal_places=2, default=20)
    required_construction_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [models.UniqueConstraint(fields=('organization', 'reference'), name='unique_organization_commission_ref')]

    def clean(self):
        if self.sale_id and self.sale.organization_id != self.organization_id:
            raise ValidationError('Commission sale must belong to the same organization.')
        if self.amount < 0 or not 0 <= self.rate_percent <= 100:
            raise ValidationError('Commission amount and rate are invalid.')
        if not 0 <= self.required_paid_percent <= 100 or not 0 <= self.required_construction_percent <= 100:
            raise ValidationError('Commission gates must be between 0 and 100.')


class SaleDocument(OrganizationOwnedModel):
    sale = models.ForeignKey(PropertySale, on_delete=models.PROTECT, related_name='legal_documents')
    document_type = models.CharField(max_length=80)
    title = models.CharField(max_length=180)
    file_url = models.URLField(blank=True)
    checksum = models.CharField(max_length=128)
    signed_on = models.DateField(null=True, blank=True)
    is_final = models.BooleanField(default=False)

    class Meta:
        ordering = ('document_type', 'title')
        constraints = [models.UniqueConstraint(fields=('sale', 'checksum'), name='unique_sale_document_checksum')]

    def clean(self):
        if self.sale_id and self.sale.organization_id != self.organization_id:
            raise ValidationError('Sale document must belong to the same organization.')
        if not self.checksum.strip():
            raise ValidationError({'checksum': 'An integrity checksum is required.'})


class SalesAuditEvent(OrganizationOwnedModel):
    sale = models.ForeignKey(PropertySale, on_delete=models.CASCADE, related_name='audit_events', null=True, blank=True)
    payment = models.ForeignKey(SalePayment, on_delete=models.CASCADE, related_name='audit_events', null=True, blank=True)
    event_type = models.CharField(max_length=50)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sales_audit_events')

    class Meta:
        ordering = ('-created_at',)

    def clean(self):
        if not self.sale_id and not self.payment_id:
            raise ValidationError('An audit event must reference a sale or payment.')
        if self.sale_id and self.sale.organization_id != self.organization_id:
            raise ValidationError('Audit sale must belong to the same organization.')
        if self.payment_id and self.payment.organization_id != self.organization_id:
            raise ValidationError('Audit payment must belong to the same organization.')


class OutreachCampaign(OrganizationOwnedModel):
    class ModuleTarget(models.TextChoices):
        PROPERTY = 'property', 'Property Management & Sectional Titles'
        FACILITY = 'facility', 'Facility Management & Operations'
        CONSTRUCTION = 'construction', 'Project Monitoring & Construction'
        VALUATION = 'valuation', 'Valuation & Advisory'
        TENDER = 'tender', 'Tenders & Procurement'
        SALES = 'sales', 'Real Estate Sales CRM'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'

    name = models.CharField(max_length=180)
    target_module = models.CharField(max_length=32, choices=ModuleTarget.choices, default=ModuleTarget.PROPERTY)
    target_icp = models.TextField(help_text='Ideal Customer Profile definition (e.g. Commercial property management companies with 30+ units)')
    pain_points = models.TextField(help_text='Core operational bottlenecks and pain points addressed by this module')
    value_proposition = models.TextField(help_text='The compelling hook and quantifiable outcome')
    booking_url = models.URLField(max_length=255, blank=True, help_text='Demo booking link e.g. Cal.com / Calendly / WhatsApp link')
    daily_send_limit = models.PositiveIntegerField(default=50)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(fields=('organization', 'name'), name='unique_org_outreach_campaign_name')
        ]

    def __str__(self):
        return f"{self.name} ({self.get_target_module_display()})"


class OutreachSequenceStep(OrganizationOwnedModel):
    campaign = models.ForeignKey(OutreachCampaign, on_delete=models.CASCADE, related_name='steps')
    step_number = models.PositiveSmallIntegerField(default=1)
    title = models.CharField(max_length=120, default='Initial Hook Opener')
    delay_days = models.PositiveSmallIntegerField(default=0, help_text='Delay in days before sending after previous step')
    subject_template = models.CharField(max_length=255)
    body_template = models.TextField()

    class Meta:
        ordering = ('step_number',)
        constraints = [
            models.UniqueConstraint(fields=('campaign', 'step_number'), name='unique_campaign_step_number')
        ]

    def __str__(self):
        return f"{self.campaign.name} - Step {self.step_number}: {self.title}"


class OutreachProspect(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DISCOVERED = 'discovered', 'Discovered'
        QUALIFIED = 'qualified', 'Qualified'
        CONTACTED = 'contacted', 'Contacted'
        REPLIED = 'replied', 'Replied'
        DEMO_BOOKED = 'demo_booked', 'Demo Booked'
        WON = 'won', 'Customer Won'
        LOST = 'lost', 'Not Interested'
        BOUNCED = 'bounced', 'Bounced'

    campaign = models.ForeignKey(OutreachCampaign, on_delete=models.PROTECT, related_name='prospects')
    company_name = models.CharField(max_length=180)
    website = models.URLField(max_length=255, blank=True)
    contact_name = models.CharField(max_length=180)
    job_title = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    linkedin_url = models.URLField(max_length=255, blank=True)
    city = models.CharField(max_length=80, blank=True, default='Nairobi')
    country = models.CharField(max_length=60, blank=True, default='Kenya')
    fit_score = models.PositiveSmallIntegerField(default=85, help_text='AI qualification score 0-100')
    fit_reasoning = models.TextField(blank=True, help_text='AI explanation of why this prospect is an exact match for the module')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUALIFIED)
    current_step = models.PositiveSmallIntegerField(default=0)
    last_contacted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-fit_score', '-created_at')
        constraints = [
            models.UniqueConstraint(fields=('organization', 'campaign', 'company_name', 'email'), name='unique_org_campaign_prospect')
        ]

    def __str__(self):
        return f"{self.contact_name} @ {self.company_name} ({self.fit_score}%)"


class OutreachActivity(OrganizationOwnedModel):
    class ActivityType(models.TextChoices):
        SENT = 'sent', 'Email Sent'
        OPENED = 'opened', 'Email Opened'
        REPLIED = 'replied', 'Reply Received'
        DEMO_BOOKED = 'demo_booked', 'Demo Scheduled'
        NOTE = 'note', 'Note Added'
        BOUNCED = 'bounced', 'Email Bounced'

    prospect = models.ForeignKey(OutreachProspect, on_delete=models.CASCADE, related_name='activities')
    step = models.ForeignKey(OutreachSequenceStep, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices, default=ActivityType.SENT)
    subject = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.get_activity_type_display()} - {self.prospect.contact_name}"
