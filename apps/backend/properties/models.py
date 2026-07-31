from django.db import models
from django.core.exceptions import ValidationError

from core.models import OrganizationOwnedModel


class Property(OrganizationOwnedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        DISPOSED = 'disposed', 'Disposed'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    property_type = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, default='KE')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(
            fields=('organization', 'code'), name='unique_organization_property_code'
        )]

    def __str__(self):
        return f'{self.code} — {self.name}'


class Building(OrganizationOwnedModel):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='buildings')
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=160)
    floors = models.PositiveSmallIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'name')
        constraints = [models.UniqueConstraint(
            fields=('property', 'code'), name='unique_property_building_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Building and property must belong to the same organization.')

    def __str__(self):
        return f'{self.property.code}/{self.code}'


class Unit(OrganizationOwnedModel):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        RESERVED = 'reserved', 'Reserved'
        OCCUPIED = 'occupied', 'Occupied'
        SOLD = 'sold', 'Sold'
        UNAVAILABLE = 'unavailable', 'Unavailable'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='units')
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='units', null=True, blank=True)
    code = models.CharField(max_length=40)
    floor = models.CharField(max_length=20, blank=True)
    unit_type = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    area = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('property__name', 'code')
        constraints = [models.UniqueConstraint(
            fields=('property', 'code'), name='unique_property_unit_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Unit and property must belong to the same organization.')
        if self.building_id and self.building.property_id != self.property_id:
            raise ValidationError({'building': 'The building must belong to the selected property.'})

    def __str__(self):
        return f'{self.property.code}/{self.code}'


class Project(OrganizationOwnedModel):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        ACTIVE = 'active', 'Active'
        ON_HOLD = 'on_hold', 'On hold'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    property = models.ForeignKey(Property, on_delete=models.SET_NULL, related_name='projects', null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('name',)
        constraints = [models.UniqueConstraint(
            fields=('organization', 'code'), name='unique_organization_project_code'
        )]

    def clean(self):
        if self.property_id and self.organization_id != self.property.organization_id:
            raise ValidationError('Project and property must belong to the same organization.')

    def __str__(self):
        return f'{self.code} — {self.name}'
