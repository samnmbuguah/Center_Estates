"""
Project ViewSet – project-level CRUD and mobile-friendly action endpoints.
"""
from decimal import Decimal
from time import time

from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import BoQItem, Project, ProjectMembership, QualityTest
from ..serializers import (
    BoQItemSerializer, MilestoneBoQItemSerializer, ProjectSerializer,
    ProjectMembershipSerializer, QualityTestSerializer,
)
from .base import ConstructionScopedViewSet


class ProjectViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.project_admin'
    queryset = Project.objects.select_related("portfolio_project")
    serializer_class = ProjectSerializer
    search_fields = ("name", "code", "client_name", "location")

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            created_at=int(time() * 1000),
        )

    @action(detail=True, methods=["get"], url_path="boq-items")
    def boq_items(self, request, pk=None):
        project = self.get_object()
        items = BoQItem.objects.filter(project=project).order_by("section", "item_number")
        return Response([{
            "id": i.id,
            "section": i.section,
            "item_number": i.item_number,
            "description": i.description,
            "unit": i.unit,
            "quantity": str(i.quantity or ""),
            "rate": str(i.rate or ""),
            "amount": str(i.amount or ""),
            "cost_state": i.cost_state,
            "approval_status": i.approval_status,
            "certified_quantity": str(i.certified_quantity or ""),
            "certified_amount": str(i.certified_amount or ""),
            "executed_quantity": str(i.executed_quantity or ""),
            "progress_updated_at": i.progress_updated_at,
        } for i in items])

    @action(detail=True, methods=["patch"], url_path=r"boq-items/(?P<boq_id>[^/.]+)/progress")
    def boq_item_progress_update(self, request, pk=None, boq_id=None):
        project = self.get_object()
        item = BoQItem.objects.filter(id=boq_id, project=project).first()
        if not item:
            return Response({"error": "BoQ item not found."}, status=404)
        executed = request.data.get("executed_quantity")
        if executed is None:
            return Response({"error": "executed_quantity is required"}, status=400)
        item.executed_quantity = Decimal(str(executed))
        item.progress_updated_at = int(time() * 1000)
        item.save(update_fields=["executed_quantity", "progress_updated_at"])
        return Response({
            "id": item.id,
            "executed_quantity": str(item.executed_quantity),
            "progress_updated_at": item.progress_updated_at,
        })

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()
        members = ProjectMembership.objects.filter(project=project).select_related("user")
        meta = project.metadata if isinstance(getattr(project, "metadata", None), dict) else {}
        team_dir = meta.get("team_directory", [])
        data = [{
            "id": m.id,
            "user_id": m.user_id,
            "username": m.user.username if m.user else "",
            "role": m.role,
            "label": m.label,
        } for m in members]
        for t in team_dir:
            if isinstance(t, dict):
                data.append({
                    "id": t.get("name"),
                    "name": t.get("name"),
                    "role": t.get("role"),
                    "firm": t.get("firm"),
                    "email": t.get("email"),
                    "phone": t.get("phone"),
                })
        return Response(data)

    @action(detail=True, methods=["get", "post"], url_path="quality-tests")
    def quality_tests(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = QualityTestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(
                project=project,
                organization=project.organization,
                created_at=int(time() * 1000),
            )
            return Response(serializer.data, status=201)
        tests = QualityTest.objects.filter(project=project).order_by("-test_date")
        return Response(QualityTestSerializer(tests, many=True).data)
