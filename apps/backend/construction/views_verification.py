"""
API Views for BIM Model Ingestion, Automated Quantity Verification & IQSK Benchmarks.
"""
import time
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Count

from core.tenancy import get_active_organization
from construction.models import BimDiscrepancy, IQSKCostRate, Project
from construction.serializers_verification import (
    IQSKCostRateSerializer,
    BimBoqVerificationUploadSerializer
)
from construction.services.bim_verifier import BimBoqVerifier


class BimBoqVerifyView(APIView):
    """
    POST /api/v1/construction/bim/verify-quantities/
    Ingests structural BIM (.ifc) and Bill of Quantities (.xlsx / .csv),
    computes physical quantities, flags variances/omissions, benchmarks
    costs against the IQSK Construction Costs Handbook, and automatically
    logs detected discrepancies into the project's BimDiscrepancy register.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = BimBoqVerificationUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ifc_file = serializer.validated_data["ifc_file"]
        boq_file = serializer.validated_data.get("boq_file")
        boq_json = serializer.validated_data.get("boq_json")
        project_id = str(request.data.get("project_id") or request.query_params.get("project_id") or "").strip()

        try:
            ifc_bytes = ifc_file.read()
            boq_items = []

            if boq_file:
                boq_bytes = boq_file.read()
                boq_items = BimBoqVerifier.parse_boq_file(boq_bytes, boq_file.name)
            elif boq_json and isinstance(boq_json, list):
                boq_items = boq_json

            # Initialize verifier
            verifier = BimBoqVerifier(ifc_source=ifc_bytes, boq_data=boq_items)
            
            # Extract QTO
            verifier.extract_model_quantities()

            # If BoQ items exist, run reconciliation audit
            if boq_items:
                audit_result = verifier.reconcile()

                # Automatically persist discrepancies to BimDiscrepancy register if project_id is provided
                logged_discrepancies = 0
                if project_id:
                    org = get_active_organization(request)
                    project = (
                        Project.objects.filter(id=project_id, organization=org).first()
                        if org else Project.objects.filter(id=project_id).first()
                    )
                    if project:
                        now_ms = int(time.time() * 1000)
                        for row in audit_result.get("audit_matrix", []):
                            row_status = str(row.get("status") or "")
                            if row_status in ("CRITICAL_DISCREPANCY", "OMISSION", "VARIANCE"):
                                key_slug = str(row.get("key") or "elem")[:18]
                                disc_id = f"bim-{str(project.id)[:12]}-{key_slug}"[:36]
                                sev = "high" if row_status in ("CRITICAL_DISCREPANCY", "OMISSION") else "medium"
                                desc = (
                                    f"[{row_status}] {row.get('label', key_slug)}: "
                                    f"BIM Model QTO = {row.get('model_qty', 0)} {row.get('unit', '')} vs "
                                    f"BoQ = {row.get('boq_qty', 0)} {row.get('unit', '')} "
                                    f"(Variance: {row.get('variance_pct', 0):.1f}%, Exposure: KES {row.get('financial_exposure', 0):,.2f})"
                                )
                                BimDiscrepancy.objects.update_or_create(
                                    id=disc_id,
                                    defaults={
                                        "project": project,
                                        "organization": project.organization,
                                        "milestone_ref": key_slug,
                                        "description": desc,
                                        "severity": sev,
                                        "status": "open",
                                        "confidence_score": 95,
                                        "created_at": now_ms,
                                        "updated_at": now_ms,
                                    },
                                )
                                logged_discrepancies += 1
                audit_result["logged_discrepancies"] = logged_discrepancies

                return Response({
                    "status": "success",
                    "filename": ifc_file.name,
                    "boq_filename": boq_file.name if boq_file else "direct_json",
                    "data": audit_result
                }, status=status.HTTP_200_OK)
            else:
                # Standalone Model QTO
                return Response({
                    "status": "success",
                    "filename": ifc_file.name,
                    "mode": "standalone_qto",
                    "data": {
                        "physical_summary": verifier.summary_quantities,
                        "elements_detail": verifier.extracted_elements[:200]
                    }
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to process BIM / BoQ verification: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class IQSKRateListView(APIView):
    """
    GET /api/v1/construction/iqsk-rates/
    Query and search extracted IQSK Construction Cost Handbook rates.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        qs = IQSKCostRate.objects.all()

        trade = request.query_params.get("trade")
        if trade:
            qs = qs.filter(trade=trade.upper())

        unit = request.query_params.get("unit")
        if unit:
            qs = qs.filter(unit=unit.upper())

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(description__icontains=search) |
                Q(subcategory__icontains=search) |
                Q(item_code__icontains=search)
            )

        # Pagination
        try:
            limit = min(int(request.query_params.get("limit", 50)), 200)
            offset = max(int(request.query_params.get("offset", 0)), 0)
        except ValueError:
            limit = 50
            offset = 0

        total_count = qs.count()
        page_items = qs[offset:offset + limit]

        serializer = IQSKCostRateSerializer(page_items, many=True)
        return Response({
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "results": serializer.data
        })


class IQSKRateSummaryView(APIView):
    """
    GET /api/v1/construction/iqsk-rates/summary/
    Returns handbook metadata and item counts aggregated by trade.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        trades_summary = list(
            IQSKCostRate.objects.values("trade")
            .annotate(item_count=Count("id"))
            .order_by("trade")
        )

        total_rates = sum(t["item_count"] for t in trades_summary)

        return Response({
            "handbook_edition": "2023-2024",
            "publisher": "Institute of Quantity Surveyors of Kenya (IQSK) / State Dept for Public Works / KNBS",
            "total_rates": total_rates,
            "trades": trades_summary
        })
