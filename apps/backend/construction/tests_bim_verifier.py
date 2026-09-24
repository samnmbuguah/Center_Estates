"""
Unit and integration tests for BimBoqVerifier quantity take-off and IQSK benchmarking.
"""
from decimal import Decimal
import tempfile
import ifcopenshell
import ifcopenshell.guid
from django.test import TestCase

from construction.models import IQSKCostRate
from construction.services.bim_verifier import BimBoqVerifier


class BimBoqVerifierTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Seed test IQSK Cost Rates
        IQSKCostRate.objects.create(
            trade="CONCRETE",
            subcategory="Vibrated Reinforced Concrete",
            item_code="CONC-0001",
            description="Vibrated Reinforced Concrete Class 25/20 in Columns",
            unit="CM",
            rate_nairobi=Decimal("15800.00"),
            rate_kes=Decimal("15800.00"),
            handbook_edition="2023-2024"
        )
        IQSKCostRate.objects.create(
            trade="CONCRETE",
            subcategory="Vibrated Reinforced Concrete",
            item_code="CONC-0002",
            description="Vibrated Reinforced Concrete Class 25/20 in Beams",
            unit="CM",
            rate_nairobi=Decimal("15500.00"),
            rate_kes=Decimal("15500.00"),
            handbook_edition="2023-2024"
        )
        IQSKCostRate.objects.create(
            trade="CONCRETE",
            subcategory="Vibrated Reinforced Concrete",
            item_code="CONC-0003",
            description="Vibrated Reinforced Concrete Class 25/20 in Suspended Slabs",
            unit="CM",
            rate_nairobi=Decimal("15200.00"),
            rate_kes=Decimal("15200.00"),
            handbook_edition="2023-2024"
        )
        IQSKCostRate.objects.create(
            trade="REINFORCEMENT",
            subcategory="High Tensile Ribbed Bars",
            item_code="REIN-0001",
            description="High Tensile Ribbed Reinforcement Bars 16mm (T16)",
            unit="KG",
            rate_nairobi=Decimal("225.00"),
            rate_kes=Decimal("225.00"),
            handbook_edition="2023-2024"
        )
        IQSKCostRate.objects.create(
            trade="FORMWORK",
            subcategory="Sawn Formwork",
            item_code="FORM-0001",
            description="Sawn Formwork to Vertical Sides of Columns",
            unit="SM",
            rate_nairobi=Decimal("610.00"),
            rate_kes=Decimal("610.00"),
            handbook_edition="2023-2024"
        )

    def _create_synthetic_ifc(self) -> bytes:
        """Constructs a lightweight, valid IFC4 model with structural elements."""
        f = ifcopenshell.file(schema="IFC4")
        
        # Context
        owner_history = f.create_entity(
            "IfcOwnerHistory",
            OwningUser=f.create_entity(
                "IfcPersonAndOrganization",
                ThePerson=f.create_entity("IfcPerson", FamilyName="Antigravity"),
                TheOrganization=f.create_entity("IfcOrganization", Name="Center Estates"),
            ),
            OwningApplication=f.create_entity(
                "IfcApplication",
                ApplicationDeveloper=f.create_entity("IfcOrganization", Name="Center Estates"),
                Version="1.0",
                ApplicationFullName="Antigravity BIM",
                ApplicationIdentifier="AGY_BIM"
            ),
            ChangeAction="NOTDEFINED",
            CreationDate=1600000000
        )
        
        ctx = f.create_entity(
            "IfcGeometricRepresentationContext",
            ContextType="Model",
            CoordinateSpaceDimension=3,
            Precision=1e-5,
            WorldCoordinateSystem=f.create_entity(
                "IfcAxis2Placement3D",
                Location=f.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0))
            )
        )
        
        project = f.create_entity("IfcProject", GlobalId=ifcopenshell.guid.new(), OwnerHistory=owner_history, Name="Test Structural Project")
        
        # 4 Footings
        for i in range(4):
            f.create_entity("IfcFooting", GlobalId=ifcopenshell.guid.new(), Name=f"Pad Footing F{i+1}")
            
        # 4 Columns
        for i in range(4):
            f.create_entity("IfcColumn", GlobalId=ifcopenshell.guid.new(), Name=f"Column C{i+1}")
            
        # 4 Beams
        for i in range(4):
            f.create_entity("IfcBeam", GlobalId=ifcopenshell.guid.new(), Name=f"Ring Beam B{i+1}")
            
        # 1 Slab
        f.create_entity("IfcSlab", GlobalId=ifcopenshell.guid.new(), Name="First Floor Suspended Slab")
        
        # 4 Walls
        for i in range(4):
            f.create_entity("IfcWall", GlobalId=ifcopenshell.guid.new(), Name=f"Perimeter Wall W{i+1}")

        return f.to_string().encode("utf-8")

    def test_extract_model_quantities(self):
        ifc_bytes = self._create_synthetic_ifc()
        verifier = BimBoqVerifier(ifc_source=ifc_bytes)
        quantities = verifier.extract_model_quantities()

        counts = quantities["element_counts"]
        self.assertEqual(counts["footings"], 4)
        self.assertEqual(counts["columns"], 4)
        self.assertEqual(counts["beams"], 4)
        self.assertEqual(counts["slabs"], 1)
        self.assertEqual(counts["walls"], 4)

        conc = quantities["concrete_totals"]
        self.assertGreater(conc["total_concrete_m3"], 0.0)
        self.assertGreater(conc["columns_vol_m3"], 0.0)
        self.assertGreater(conc["beams_vol_m3"], 0.0)

        form = quantities["formwork_totals"]
        self.assertGreater(form["total_formwork_m2"], 0.0)

        rebar = quantities["rebar_totals"]
        self.assertGreater(rebar["total_rebar_kg"], 0.0)
        self.assertIn("T16", rebar["by_diameter"])

    def test_reconciliation_exact_and_variances(self):
        ifc_bytes = self._create_synthetic_ifc()
        verifier = BimBoqVerifier(ifc_source=ifc_bytes)
        qto = verifier.extract_model_quantities()

        col_vol = qto["concrete_totals"]["columns_vol_m3"]
        beam_vol = qto["concrete_totals"]["beams_vol_m3"]
        t16_kg = qto["rebar_totals"]["by_diameter"]["T16"]

        # Simulated Tender BoQ:
        # - Columns: EXACT match (within 0%)
        # - Beams: 35% OVERMEASURED (Critical Discrepancy)
        # - Reinforcement T16: Tolerable 5% lap allowance
        # - Slabs: OMITTED completely from BoQ
        boq_data = [
            {
                "description": "Vibrated Reinforced Concrete Class 25/20 in Columns",
                "unit": "CM",
                "quantity": col_vol,
                "rate": 16500.0,
            },
            {
                "description": "Vibrated Reinforced Concrete Class 25/20 in Beams",
                "unit": "CM",
                "quantity": round(beam_vol * 1.35, 2),  # +35% overmeasured
                "rate": 17000.0,
            },
            {
                "description": "High tensile ribbed reinforcement bars 16mm",
                "unit": "KG",
                "quantity": round(t16_kg * 1.05, 2),   # +5% tolerable
                "rate": 240.0,
            },
            # Note: Suspended slab is deliberately omitted!
        ]

        verifier.boq_items = boq_data
        audit_result = verifier.reconcile()

        kpis = audit_result["summary_kpis"]
        self.assertGreaterEqual(kpis["total_items_audited"], 4)
        self.assertGreaterEqual(kpis["critical_discrepancies"], 1)
        self.assertGreaterEqual(kpis["omissions_detected"], 1)

        items_by_key = {item["key"]: item for item in audit_result["audit_matrix"]}

        # Check Column match
        col_audit = items_by_key["concrete_columns"]
        self.assertEqual(col_audit["status"], "MATCHED")
        self.assertEqual(col_audit["severity"], "success")

        # Check Beam overclaim
        beam_audit = items_by_key["concrete_beams"]
        self.assertEqual(beam_audit["status"], "CRITICAL_DISCREPANCY")
        self.assertGreater(beam_audit["variance_pct"], 30.0)
        self.assertEqual(beam_audit["severity"], "critical")

        # Check Slab omission
        slab_audit = items_by_key["concrete_slabs"]
        self.assertEqual(slab_audit["status"], "OMISSION")
        self.assertEqual(slab_audit["boq_qty"], 0.0)
        self.assertGreater(slab_audit["model_qty"], 0.0)

        # Check IQSK benchmark exposure calculation
        self.assertGreater(col_audit["iqsk_rate"], 0.0)
        self.assertGreater(beam_audit["financial_exposure"], 0.0)
