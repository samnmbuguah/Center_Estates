"""
API Views for BIM Model Ingestion, Automated Quantity Verification & IQSK Benchmarks.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Count

from construction.models import IQSKCostRate
from construction.serializers_verification import (
    IQSKCostRateSerializer,
    BimBoqVerificationUploadSerializer
)
from construction.services.bim_verifier import BimBoqVerifier


class BimBoqVerifyView(APIView):
    """
    POST /api/v1/construction/bim/verify-quantities/
    Ingests structural BIM (.ifc) and Bill of Quantities (.xlsx / .csv),
    computes physical quantities, flags variances/omissions, and benchmarks
    costs against the IQSK Construction Costs Handbook.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.AllowAny]  # Can be tightened if auth required

    def post(self, request, *args, **kwargs):
        serializer = BimBoqVerificationUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ifc_file = serializer.validated_data["ifc_file"]
        boq_file = serializer.validated_data.get("boq_file")
        boq_json = serializer.validated_data.get("boq_json")

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
