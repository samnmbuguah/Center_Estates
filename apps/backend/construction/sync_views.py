import hashlib
from time import time

from django.db import transaction
from rest_framework.decorators import api_view, parser_classes, permission_classes
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Module
from core.permissions import HasModuleSubscription
from core.tenancy import get_active_organization

from .geo import classify_geofence
from .integrity import compute_integrity_hash
from .models import Device, EvidenceFile, MilestoneEntry, Observation, OfficeNote, Project, SubmissionRecord
from .signing import verify_ed25519
from .storage import store_evidence_file


def now_ms():
    return int(time() * 1000)


class ConstructionSubscription(HasModuleSubscription):
    module = Module.MONITORING


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def mobile_me(request):
    organization = get_active_organization(request)
    membership = organization.memberships.filter(user=request.user, status="active").first()
    permissions = [] if membership is None else list(
        membership.roles.values_list("permissions__key", flat=True).distinct()
    )
    if request.user.is_superuser or (membership and membership.is_organization_admin):
        permissions = ["*"]
    return Response({
        "username": request.user.get_username(),
        "is_superuser": request.user.is_superuser,
        "roles": [] if membership is None else list(membership.roles.values_list("slug", flat=True)),
        "permissions": permissions,
        "tenant_id": str(organization.id),
        "organization_id": str(organization.id),
    })


WRITABLE_FIELDS = {
    MilestoneEntry: ["project_id", "milestone_id", "percent_complete", "submitted_at", "client_signature", "signing_device_id", "required_evidence_types", "required_certifying_role", "payment_instruction", "payment_value"],
    EvidenceFile: ["milestone_entry_id", "media_type", "remote_url", "hash", "latitude", "longitude", "captured_at", "submitted_at"],
    Observation: ["milestone_entry_id", "body", "flag", "origin"],
    OfficeNote: ["milestone_entry_id", "body", "author"],
}
READABLE_FIELDS = {
    **WRITABLE_FIELDS,
    EvidenceFile: WRITABLE_FIELDS[EvidenceFile] + ["geofence_status", "distance_m"],
}
SYNC_TABLES = {
    "milestone_entries": (MilestoneEntry, True),
    "evidence_files": (EvidenceFile, True),
    "observations": (Observation, True),
    "office_notes": (OfficeNote, False),
}


def _serialize(instance, model):
    row = {"id": instance.id, "created_at": instance.created_at, "updated_at": instance.updated_at}
    for field in READABLE_FIELDS[model]:
        row[field] = getattr(instance, field)
    return row


def _is_mobile(request):
    token = getattr(request, "auth", None)
    try:
        return token.get("client_kind") == "mobile"
    except AttributeError:
        return False


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def pull(request):
    organization = get_active_organization(request)
    try:
        last = max(0, int(request.query_params.get("last_pulled_at") or 0))
    except (TypeError, ValueError):
        return Response({"error": "last_pulled_at must be an epoch millisecond integer"}, status=400)
    boundary = now_ms()
    changes = {}
    for name, (model, _mobile_authoritative) in SYNC_TABLES.items():
        window = model.objects.filter(organization=organization, updated_at__gt=last, updated_at__lte=boundary)
        alive = window.filter(deleted_at__isnull=True)
        changes[name] = {
            "created": [_serialize(item, model) for item in alive.filter(created_at__gt=last)],
            "updated": [_serialize(item, model) for item in alive.filter(created_at__lte=last)],
            "deleted": list(window.filter(deleted_at__isnull=False).values_list("id", flat=True)),
        }
    return Response({"changes": changes, "timestamp": boundary})


def _upsert(model, rows, organization, timestamp):
    writable = WRITABLE_FIELDS[model]
    for row in rows:
        record_id = row.get("id")
        if not record_id:
            continue
        instance = model.objects.filter(id=record_id, organization=organization).first()
        created = instance is None
        if created:
            instance = model(id=record_id, organization=organization, created_at=timestamp)
        elif "submitted_at" in writable and instance.submitted_at is not None:
            continue
        for field in writable:
            if field in row:
                setattr(instance, field, row[field])
        if model is MilestoneEntry:
            try:
                instance.percent_complete = max(0, min(100, int(instance.percent_complete)))
            except (TypeError, ValueError):
                instance.percent_complete = 0
            if not Project.objects.filter(id=instance.project_id, organization=organization).exists():
                raise ValueError("Unknown construction project")
        elif model in (EvidenceFile, Observation, OfficeNote):
            if not MilestoneEntry.objects.filter(id=instance.milestone_entry_id, organization=organization).exists():
                raise ValueError("Unknown milestone entry")
        instance.updated_at = timestamp
        instance.save()


def _delete(model, ids, organization, timestamp):
    queryset = model.objects.filter(id__in=ids, organization=organization)
    if "submitted_at" in WRITABLE_FIELDS[model]:
        queryset = queryset.filter(submitted_at__isnull=True)
    queryset.update(deleted_at=timestamp, updated_at=timestamp)


def _classify_evidence(ids, organization):
    projects = {project.id: project for project in Project.objects.filter(organization=organization)}
    for evidence in EvidenceFile.objects.filter(id__in=ids, organization=organization).select_related("milestone_entry"):
        project = projects.get(evidence.milestone_entry.project_id)
        verdict, distance = classify_geofence(
            evidence.latitude, evidence.longitude,
            project.site_latitude if project else None,
            project.site_longitude if project else None,
            project.geofence_radius_m if project else None,
        )
        EvidenceFile.objects.filter(pk=evidence.pk).update(geofence_status=verdict, distance_m=distance)


def _seal_milestones(ids, organization, timestamp):
    entries = MilestoneEntry.objects.filter(
        id__in=ids, organization=organization, submitted_at__isnull=False, seal__isnull=True
    )
    for entry in entries:
        evidence = list(entry.evidence.filter(deleted_at__isnull=True, organization=organization))
        observations = list(entry.observations.filter(deleted_at__isnull=True, organization=organization))
        digest = compute_integrity_hash(
            milestone_id=entry.milestone_id, project_id=entry.project_id,
            percent_complete=entry.percent_complete, submitted_at=entry.submitted_at,
            evidence_hashes=[item.hash for item in evidence],
            observation_bodies=[item.body for item in observations],
        )
        verified = False
        if entry.client_signature and entry.signing_device_id:
            device = Device.objects.filter(
                id=entry.signing_device_id, organization=organization, revoked=False
            ).first()
            if device:
                verified = verify_ed25519(device.public_key, entry.client_signature, digest.encode())
        SubmissionRecord.objects.create(
            milestone_entry=entry, integrity_hash=digest, evidence_count=len(evidence),
            sealed_at=timestamp, signature=entry.client_signature,
            device_id=entry.signing_device_id, signature_verified=verified,
        )


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["POST"])
@permission_classes([ConstructionSubscription])
def push(request):
    if not _is_mobile(request):
        return Response({"error": "A mobile client token is required."}, status=403)
    organization = get_active_organization(request)
    incoming = request.data.get("changes") or {}
    timestamp = now_ms()
    try:
        with transaction.atomic():
            for name, (model, _mobile_authoritative) in SYNC_TABLES.items():
                payload = incoming.get(name) or {}
                _upsert(model, (payload.get("created") or []) + (payload.get("updated") or []), organization, timestamp)
                _delete(model, payload.get("deleted") or [], organization, timestamp)
            evidence_payload = incoming.get("evidence_files") or {}
            evidence_ids = [row.get("id") for row in (evidence_payload.get("created") or []) + (evidence_payload.get("updated") or []) if row.get("id")]
            _classify_evidence(evidence_ids, organization)
            milestone_payload = incoming.get("milestone_entries") or {}
            milestone_ids = [row.get("id") for row in (milestone_payload.get("created") or []) + (milestone_payload.get("updated") or []) if row.get("id")]
            _seal_milestones(milestone_ids, organization, timestamp)
    except (ValueError, TypeError) as error:
        return Response({"error": str(error)}, status=400)
    return Response({"timestamp": timestamp})


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["POST"])
@permission_classes([ConstructionSubscription])
@parser_classes([MultiPartParser])
def media_upload(request):
    if not _is_mobile(request):
        return Response({"error": "A mobile client token is required."}, status=403)
    upload = request.FILES.get("file")
    if upload is None:
        return Response({"error": "file is required"}, status=400)
    if upload.size > 50 * 1024 * 1024:
        return Response({"error": "file exceeds the 50 MB evidence limit"}, status=413)
    digest = hashlib.sha256()
    for chunk in upload.chunks():
        digest.update(chunk)
    value = digest.hexdigest()
    return Response({"remote_url": store_evidence_file(upload, value), "hash": value})


@extend_schema(request=None, responses={200: {"type": "object"}}, )
@api_view(["POST"])
@permission_classes([ConstructionSubscription])
def register_device(request):
    if not _is_mobile(request):
        return Response({"error": "A mobile client token is required."}, status=403)
    organization = get_active_organization(request)
    device_id = str(request.data.get("device_id") or "").strip()
    public_key = str(request.data.get("public_key") or "").strip()
    if not device_id or not public_key:
        return Response({"error": "device_id and public_key are required"}, status=400)
    device, _ = Device.objects.update_or_create(
        id=device_id, organization=organization,
        defaults={"user": request.user, "public_key": public_key, "enrolled_at": now_ms(), "revoked": False},
    )
    return Response({"device_id": device.id, "algorithm": device.algorithm}, status=201)


@extend_schema(request=None, responses={200: {"type": "object"}}, parameters=[OpenApiParameter("milestone_id", OpenApiTypes.STR, OpenApiParameter.PATH)])
@api_view(["GET"])
@permission_classes([ConstructionSubscription])
def verify_submission(request, milestone_id):
    organization = get_active_organization(request)
    entry = MilestoneEntry.objects.filter(id=milestone_id, organization=organization).first()
    if not entry or not hasattr(entry, "seal"):
        return Response({"error": "sealed submission not found"}, status=404)
    evidence = list(entry.evidence.filter(deleted_at__isnull=True, organization=organization))
    observations = list(entry.observations.filter(deleted_at__isnull=True, organization=organization))
    current_hash = compute_integrity_hash(
        milestone_id=entry.milestone_id, project_id=entry.project_id,
        percent_complete=entry.percent_complete, submitted_at=entry.submitted_at,
        evidence_hashes=[item.hash for item in evidence],
        observation_bodies=[item.body for item in observations],
    )
    return Response({
        "milestone_entry_id": entry.id, "sealed_hash": entry.seal.integrity_hash,
        "current_hash": current_hash, "integrity_valid": current_hash == entry.seal.integrity_hash,
        "signature_verified": entry.seal.signature_verified, "evidence_count": entry.seal.evidence_count,
    })
