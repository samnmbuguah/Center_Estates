"""
Construction views – base layer.

Contains:
  - apply_project_scope / apply_property_scope  (queryset helpers)
  - ConstructionScopedViewSet                   (base ViewSet for all CRUD registers)
  - MobileCaptureMixin                          (enforce client_kind=mobile on writes)
  - ImmutableSubmittedMixin                     (append-only after submitted_at is set)
  - scoped_viewset()                            (factory for one-liner registers)
"""
from time import time

from django.db.models import Q
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import ModelViewSet

from core.models import Module
from core.permissions import HasModuleActionPermission
from core.tenancy import get_active_organization
from core.property_scope import get_active_property

from ..models import Project


def apply_project_scope(queryset, project_id: str):
    """Filter construction registers by project for both FK `project` and CharField `project_id`."""
    if not project_id:
        return queryset
    field_names = {field.name for field in queryset.model._meta.fields}
    if "project" in field_names:
        return queryset.filter(project_id=project_id)
    if "project_id" in field_names:
        return queryset.filter(project_id=project_id)
    # Related-path fallbacks for nested registers.
    related_paths = (
        "milestone_entry__project_id",
        "ticket__project_id",
        "document__project_id",
        "advance_payment__project_id",
        "bim_model__project_id",
    )
    for path in related_paths:
        root = path.split("__", 1)[0]
        if any(field.name == root for field in queryset.model._meta.fields):
            return queryset.filter(**{path: project_id})
    return queryset


def apply_property_scope(queryset, property_id: str):
    """Restrict every construction register to projects attached to one portfolio property."""
    if not property_id:
        return queryset
    project_ids = Project.objects.filter(
        portfolio_project__property_id=property_id,
    ).values_list('pk', flat=True)
    if queryset.model is Project:
        return queryset.filter(pk__in=project_ids)
    field_names = {field.name for field in queryset.model._meta.fields}
    if 'project' in field_names or 'project_id' in field_names:
        return queryset.filter(project_id__in=project_ids)
    for path in (
        'milestone_entry__project_id__in', 'ticket__project_id__in',
        'document__project_id__in', 'advance_payment__project_id__in',
        'bim_model__project_id__in',
    ):
        root = path.split('__', 1)[0]
        if root in field_names:
            return queryset.filter(**{path: project_ids})
    return queryset


class ConstructionScopedViewSet(ModelViewSet):
    permission_classes = (HasModuleActionPermission,)
    required_module = Module.MONITORING
    organization_field = "organization"
    search_fields = ()

    def get_queryset(self):
        organization = get_active_organization(self.request)
        queryset = self.queryset.filter(**{self.organization_field: organization})
        selected_property = get_active_property(self.request, organization)
        if selected_property is not None:
            queryset = apply_property_scope(queryset, str(selected_property.pk))
        search = self.request.query_params.get("search", "").strip()
        if search and self.search_fields:
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(query)
        project_id = (
            self.request.query_params.get("project")
            or self.request.query_params.get("project_id")
            or ""
        ).strip()
        return apply_project_scope(queryset, project_id)

    def _validate_organization(self, serializer):
        organization = get_active_organization(self.request)
        for name, value in serializer.validated_data.items():
            related_organization = getattr(value, "organization_id", organization.id)
            if related_organization != organization.id:
                raise ValidationError({name: "The selected record belongs to another organization."})
        return organization

    def perform_create(self, serializer):
        serializer.save(organization=self._validate_organization(serializer))

    def perform_update(self, serializer):
        self._validate_organization(serializer)
        serializer.save()


class MobileCaptureMixin:
    """Protect mobile-authoritative evidence from desktop/API impersonation."""

    def _require_mobile(self):
        token = getattr(self.request, "auth", None)
        try:
            is_mobile = token.get("client_kind") == "mobile"
        except AttributeError:
            is_mobile = False
        if not is_mobile:
            raise ValidationError({"client_kind": "This record is writable only by an enrolled mobile client."})

    def perform_create(self, serializer):
        self._require_mobile()
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._require_mobile()
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._require_mobile()
        super().perform_destroy(instance)


class ImmutableSubmittedMixin:
    """Submitted field records are append-only audit evidence."""

    def perform_update(self, serializer):
        if self.get_object().submitted_at is not None:
            raise ValidationError({"submitted_at": "Submitted records are immutable."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.submitted_at is not None:
            raise ValidationError({"submitted_at": "Submitted records cannot be deleted."})
        super().perform_destroy(instance)


def scoped_viewset(name, model, serializer, search_fields=()):
    """One-liner factory: creates a ConstructionScopedViewSet subclass for `model`."""
    return type(name, (ConstructionScopedViewSet,), {
        "queryset": model.objects.select_related("project") if any(
            field.name == "project" for field in model._meta.fields
        ) else model.objects.all(),
        "serializer_class": serializer,
        "search_fields": search_fields,
    })
