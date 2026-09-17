import uuid

from django.conf import settings
from django.db import models


class Module(models.TextChoices):
    PROPERTY = 'property', 'Property Management'
    FACILITY = 'facility', 'Facility Management'
    SALES = 'sales', 'Sales Management'
    TENDER = 'tender', 'Tender Management'
    VALUATION = 'valuation', 'Valuation'
    MONITORING = 'monitoring', 'Construction Monitoring'
    COMPANION = 'companion', 'Companion & Staff Performance'


class OrganizationQuerySet(models.QuerySet):
    def for_organization(self, organization):
        if organization is None:
            return self.none()
        return self.filter(organization=organization)


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrganizationOwnedModel(TimeStampedModel):
    organization = models.ForeignKey('organizations.Organization', on_delete=models.PROTECT)
    objects = OrganizationQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ClientErrorEvent(TimeStampedModel):
    """Deduplicated browser errors for operational diagnostics.

    This intentionally stores a bounded technical payload only. It is not an
    audit trail for user-entered form values or a replacement for application
    logs.
    """

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        RESOLVED = 'resolved', 'Resolved'
        IGNORED = 'ignored', 'Ignored'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='client_error_events',
    )
    fingerprint = models.CharField(max_length=64, db_index=True)
    message = models.CharField(max_length=500)
    stack = models.TextField(blank=True)
    component_stack = models.TextField(blank=True)
    url = models.CharField(max_length=500, blank=True)
    release = models.CharField(max_length=50, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    occurrences = models.PositiveIntegerField(default=1)
    first_seen_at = models.DateTimeField()
    last_seen_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)

    class Meta:
        ordering = ('-last_seen_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('organization', 'fingerprint'),
                name='unique_client_error_event_per_organization_fingerprint',
            ),
        ]


class FeatureTestProgress(OrganizationOwnedModel):
    """Per-organisation acceptance-test evidence for the curated release checklist."""

    class Status(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not started'
        IN_PROGRESS = 'in_progress', 'In progress'
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'
        BLOCKED = 'blocked', 'Blocked'

    feature_key = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    notes = models.TextField(blank=True)
    evidence_url = models.URLField(blank=True)
    tested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='feature_test_progress',
    )
    tested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('feature_key',)
        constraints = [
            models.UniqueConstraint(
                fields=('organization', 'feature_key'),
                name='unique_feature_test_progress_per_organization',
            ),
        ]


class CITestResult(models.Model):
    """Platform-wide CI acceptance-run result pushed by the CI pipeline."""

    run_number = models.IntegerField()
    conclusion = models.CharField(max_length=20)  # success, failure, cancelled, etc.
    total_specs = models.IntegerField(default=0)
    passed_specs = models.IntegerField(default=0)
    failed_specs = models.IntegerField(default=0)
    head_sha = models.CharField(max_length=40, blank=True)
    run_url = models.URLField(blank=True)
    branch = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
