"""
Serializers for BIM Quantity Take-Off (QTO) & IQSK Cost Rates Verification.
"""
from rest_framework import serializers
from construction.models import IQSKCostRate


class IQSKCostRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IQSKCostRate
        fields = [
            "id",
            "trade",
            "subcategory",
            "item_code",
            "description",
            "unit",
            "rate_nairobi",
            "rate_coastal",
            "rate_western",
            "rate_kes",
            "handbook_edition",
            "source_page",
            "created_at",
            "updated_at",
        ]


class BimBoqVerificationUploadSerializer(serializers.Serializer):
    ifc_file = serializers.FileField(
        required=True,
        help_text="Structural BIM drawing file (.ifc)"
    )
    boq_file = serializers.FileField(
        required=False,
        allow_null=True,
        help_text="Tender Bill of Quantities (BoQ) spreadsheet (.xlsx or .csv)"
    )
    boq_json = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Optional JSON payload of BoQ line items: [{description, unit, quantity, rate}]"
    )

    def validate_ifc_file(self, value):
        ext = value.name.lower().split(".")[-1]
        if ext != "ifc":
            raise serializers.ValidationError("File must be an Industry Foundation Classes (.ifc) file.")
        return value

    def validate_boq_file(self, value):
        if value:
            ext = value.name.lower().split(".")[-1]
            if ext not in ["xlsx", "csv"]:
                raise serializers.ValidationError("BoQ file must be an Excel (.xlsx) or CSV (.csv) file.")
        return value
