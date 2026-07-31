import uuid

from django.db import models


class Module(models.TextChoices):
    PROPERTY = 'property', 'Property Management'
    FACILITY = 'facility', 'Facility Management'
    SALES = 'sales', 'Sales Management'
    TENDER = 'tender', 'Tender Management'
    VALUATION = 'valuation', 'Valuation'
    MONITORING = 'monitoring', 'Construction Monitoring'


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
