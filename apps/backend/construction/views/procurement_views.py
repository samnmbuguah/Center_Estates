"""
Procurement & store ViewSets:
  StoreItem, StoreSupplier, MaterialRequisition, PurchaseOrder, StockMovement.
"""
from decimal import Decimal
from time import time

from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.tenancy import get_active_organization

from ..models import (
    MaterialRequisition, MaterialRequisitionLine,
    Project, PurchaseOrder, PurchaseOrderLine,
    StockMovement, StoreItem, StoreSupplier,
)
from ..serializers import (
    MaterialRequisitionSerializer, PurchaseOrderSerializer,
    StockMovementSerializer, StoreItemSerializer, StoreSupplierSerializer,
)
from .base import ConstructionScopedViewSet


class StoreItemViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StoreItem.objects.all()
    serializer_class = StoreItemSerializer
    search_fields = ("code", "name", "category")

    def perform_create(self, serializer):
        serializer.save(
            organization=self._validate_organization(serializer),
            quantity_on_hand=0,
            created_at=int(time() * 1000),
        )

    def perform_update(self, serializer):
        if "quantity_on_hand" in serializer.validated_data:
            raise ValidationError({"quantity_on_hand": "Stock changes must be posted through the movement controls."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.movements.exists():
            raise ValidationError({"item": "Items with stock history cannot be deleted."})
        instance.delete()

    def _movement(self, request, item, movement_type, signed_quantity, reference, project=None):
        organization = get_active_organization(request)
        locked = StoreItem.objects.select_for_update().get(pk=item.pk, organization=organization)
        new_balance = locked.quantity_on_hand + signed_quantity
        if new_balance < 0:
            raise ValidationError({"quantity": "The issue exceeds available stock."})
        locked.quantity_on_hand = new_balance
        locked.save(update_fields=("quantity_on_hand",))
        StockMovement.objects.create(
            organization=organization,
            project=project,
            item=locked,
            movement_type=movement_type,
            quantity=signed_quantity,
            reference=reference,
            created_by=request.user,
            created_at=int(time() * 1000),
        )
        return Response(StoreItemSerializer(locked).data)

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def issue(self, request, pk=None):
        item = self.get_object()
        quantity = Decimal(str(request.data.get("quantity", 0)))
        movement_type = str(request.data.get("type", "issue"))
        if movement_type not in ("issue", "return") or quantity <= 0:
            raise ValidationError({"quantity": "Use a positive quantity and type issue or return."})
        project = None
        if request.data.get("project"):
            project = Project.objects.filter(
                pk=request.data["project"], organization=get_active_organization(request)
            ).first()
            if not project:
                raise ValidationError({"project": "Project not found in this organization."})
        signed = -quantity if movement_type == "issue" else quantity
        return self._movement(request, item, movement_type, signed, str(request.data.get("reference", "")), project)

    @action(detail=True, methods=("post",), url_path="stock-take")
    @transaction.atomic
    def stock_take(self, request, pk=None):
        item = self.get_object()
        counted = Decimal(str(request.data.get("counted", -1)))
        if counted < 0:
            raise ValidationError({"counted": "Counted stock cannot be negative."})
        locked = StoreItem.objects.select_for_update().get(pk=item.pk, organization=get_active_organization(request))
        return self._movement(
            request, locked, "adjustment",
            counted - locked.quantity_on_hand,
            str(request.data.get("reason", "Stock take")),
        )


class StoreSupplierViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StoreSupplier.objects.all()
    serializer_class = StoreSupplierSerializer
    search_fields = ("name", "contact")


class MaterialRequisitionViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = MaterialRequisition.objects.select_related("project", "raised_by").prefetch_related("lines__item")
    serializer_class = MaterialRequisitionSerializer
    search_fields = ("reference", "project__name")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        lines = serializer.validated_data.pop("lines", [])
        if not lines:
            raise ValidationError({"lines": "At least one requisition line is required."})
        for line in lines:
            if line["item"].organization_id != organization.id or line["quantity"] <= 0:
                raise ValidationError({"lines": "Every item must belong to this organization and have a positive quantity."})
        requisition = serializer.save(
            organization=organization,
            raised_by=self.request.user,
            status="submitted",
            created_at=int(time() * 1000),
        )
        MaterialRequisitionLine.objects.bulk_create(
            [MaterialRequisitionLine(requisition=requisition, **line) for line in lines]
        )

    def perform_update(self, serializer):
        if "lines" in serializer.validated_data:
            raise ValidationError({"lines": "Submitted requisition lines are immutable."})
        super().perform_update(serializer)

    def _transition(self, request, pk, allowed, target, label):
        organization = get_active_organization(request)
        requisition = MaterialRequisition.objects.select_for_update().filter(
            pk=pk, organization=organization
        ).first()
        if not requisition:
            return Response({"detail": "Material requisition not found."}, status=404)
        if requisition.status not in allowed:
            raise ValidationError({"status": f"Only {label} requisitions can move to {target}."})
        requisition.status = target
        requisition.save(update_fields=("status",))
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def approve(self, request, pk=None):
        return self._transition(request, pk, ("submitted",), "approved", "submitted")

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def reject(self, request, pk=None):
        return self._transition(request, pk, ("submitted", "approved"), "rejected", "submitted or approved")

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def fulfill(self, request, pk=None):
        organization = get_active_organization(request)
        requisition = MaterialRequisition.objects.select_for_update().prefetch_related(
            "lines__item"
        ).filter(pk=pk, organization=organization).first()
        if not requisition:
            return Response({"detail": "Material requisition not found."}, status=404)
        if requisition.status != "approved":
            raise ValidationError({"status": "Only approved requisitions can be fulfilled."})
        now = int(time() * 1000)
        for line in requisition.lines.all():
            item = StoreItem.objects.select_for_update().get(pk=line.item_id)
            if item.quantity_on_hand < line.quantity:
                raise ValidationError({
                    "stock": f"Insufficient stock for {item.name}: {item.quantity_on_hand} available, {line.quantity} requested."
                })
            item.quantity_on_hand -= line.quantity
            item.save(update_fields=("quantity_on_hand",))
            StockMovement.objects.create(
                organization=organization,
                project=requisition.project,
                item=item,
                movement_type="issue",
                quantity=-line.quantity,
                reference=requisition.reference,
                created_by=request.user,
                created_at=now,
            )
        requisition.status = "fulfilled"
        requisition.save(update_fields=("status",))
        return Response(self.get_serializer(requisition).data)


class PurchaseOrderViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = PurchaseOrder.objects.select_related("project", "supplier", "created_by").prefetch_related("lines__item")
    serializer_class = PurchaseOrderSerializer
    search_fields = ("number", "project__name", "supplier__name")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = self._validate_organization(serializer)
        lines = serializer.validated_data.pop("lines", [])
        if not lines:
            raise ValidationError({"lines": "At least one purchase-order line is required."})
        for line in lines:
            if line["item"].organization_id != organization.id or line["quantity"] <= 0:
                raise ValidationError({"lines": "Every item must belong to this organization and have a positive quantity."})
        order = serializer.save(
            organization=organization,
            created_by=self.request.user,
            status="sent",
            created_at=int(time() * 1000),
        )
        PurchaseOrderLine.objects.bulk_create(
            [PurchaseOrderLine(purchase_order=order, **line) for line in lines]
        )

    def perform_update(self, serializer):
        if self.get_object().status in ("received", "closed"):
            raise ValidationError({"purchase_order": "Received orders are immutable."})
        if "lines" in serializer.validated_data:
            raise ValidationError({"lines": "Sent purchase-order lines are immutable."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status != "draft":
            raise ValidationError({"purchase_order": "Only draft purchase orders can be deleted."})
        instance.delete()

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def receive(self, request, pk=None):
        organization = get_active_organization(request)
        order = PurchaseOrder.objects.select_for_update().prefetch_related("lines__item").filter(
            pk=pk, organization=organization
        ).first()
        if not order:
            return Response({"detail": "Purchase order not found."}, status=404)
        if order.status != "sent":
            raise ValidationError({"status": "Only a sent purchase order can be received."})
        now = int(time() * 1000)
        for line in order.lines.all():
            item = StoreItem.objects.select_for_update().get(pk=line.item_id)
            item.quantity_on_hand += line.quantity
            item.save(update_fields=("quantity_on_hand",))
            StockMovement.objects.create(
                organization=organization,
                project=order.project,
                item=item,
                movement_type="grn",
                quantity=line.quantity,
                reference=order.number,
                created_by=request.user,
                created_at=now,
            )
        order.status = "received"
        order.received_at = now
        order.save(update_fields=("status", "received_at"))
        return Response(PurchaseOrderSerializer(order).data)


class StockMovementViewSet(ConstructionScopedViewSet):
    write_permission = 'monitoring.procurement'
    queryset = StockMovement.objects.select_related("project", "item", "created_by")
    serializer_class = StockMovementSerializer
    http_method_names = ("get", "head", "options")
    search_fields = ("item__code", "item__name", "reference", "movement_type")
