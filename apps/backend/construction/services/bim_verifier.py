"""
BIM (IFC) Drawing vs. Bill of Quantities (BoQ) Automated Verification Service.
Utilizes IfcOpenShell to ingest structural models, calculate physical quantities,
reconcile against tender BoQ line items, detect quantity variances and omissions,
and benchmark financial exposure against IQSK National Cost Handbook rates.
"""
from __future__ import annotations

import io
import re
import csv
import math
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal

try:
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.element
    import ifcopenshell.util.placement
    HAS_IFCOPENSHELL = True
except ImportError:
    ifcopenshell = None
    HAS_IFCOPENSHELL = False

import openpyxl

from construction.models import IQSKCostRate


# Standard Kenyan / BS 8110 Rebar Density Estimates (kg per m3 of concrete)
# Used when structural model does not have explicit micro-modeled reinforcement bars
REBAR_RATIO_KG_PER_M3 = {
    "IfcFooting": 100.0,
    "IfcColumn": 160.0,
    "IfcBeam": 145.0,
    "IfcSlab": 95.0,
    "IfcWall": 80.0,
    "default": 110.0,
}

# Standard nominal mass for steel reinforcing bars (kg per linear meter)
REBAR_NOMINAL_MASS_KG_M = {
    8: 0.395,
    10: 0.617,
    12: 0.888,
    16: 1.580,
    20: 2.470,
    25: 3.850,
    32: 6.310,
    40: 9.860,
}


class BimBoqVerifier:
    """
    Automated Quantity Take-off (QTO) & BoQ Audit Engine.
    """

    def __init__(self, ifc_source: str | bytes, boq_data: List[Dict[str, Any]] | None = None):
        """
        Initialize with an IFC file path or raw bytes, and optional BoQ item list.
        """
        if not HAS_IFCOPENSHELL or ifcopenshell is None:
            raise RuntimeError("IfcOpenShell is not installed in this environment. BIM IFC extraction requires the ifcopenshell package.")

        if isinstance(ifc_source, bytes):
            self.model = ifcopenshell.file.from_string(ifc_source.decode("utf-8", errors="ignore"))
        elif isinstance(ifc_source, str):
            self.model = ifcopenshell.open(ifc_source)
        else:
            raise ValueError("ifc_source must be a file path string or bytes.")

        self.boq_items = boq_data or []
        self.extracted_elements: List[Dict[str, Any]] = []
        self.summary_quantities: Dict[str, float] = {}

    # -------------------------------------------------------------------------
    # 1. IFC Quantity Extraction
    # -------------------------------------------------------------------------
    def extract_model_quantities(self) -> Dict[str, Any]:
        """
        Extracts structural quantities from the IFC model for:
        - Concrete elements: Footings, Columns, Beams, Slabs, Walls
        - Reinforcement: Modeled rebar or estimated reinforcement
        - Formwork: Contact areas for columns, beams, slabs, footings
        """
        elements_detail = []
        concrete_totals = {
            "footings_vol_m3": 0.0,
            "columns_vol_m3": 0.0,
            "beams_vol_m3": 0.0,
            "slabs_vol_m3": 0.0,
            "walls_vol_m3": 0.0,
            "total_concrete_m3": 0.0,
        }
        formwork_totals = {
            "columns_formwork_m2": 0.0,
            "beams_formwork_m2": 0.0,
            "slabs_formwork_m2": 0.0,
            "footings_formwork_m2": 0.0,
            "total_formwork_m2": 0.0,
        }
        rebar_totals = {
            "modeled_rebar_kg": 0.0,
            "estimated_rebar_kg": 0.0,
            "total_rebar_kg": 0.0,
            "by_diameter": {},
        }
        walling_totals = {
            "walls_area_m2": 0.0,
        }

        # 1. Footings
        footings = self.model.by_type("IfcFooting")
        for f in footings:
            vol = self._get_element_volume(f) or 0.85
            concrete_totals["footings_vol_m3"] += vol
            # Formwork side contact area approx
            side_area = (math.sqrt(max(0.1, vol / 0.45)) * 4) * 0.45
            formwork_totals["footings_formwork_m2"] += side_area
            elements_detail.append({
                "guid": f.GlobalId,
                "ifc_class": "IfcFooting",
                "name": f.Name or "Pad / Strip Footing",
                "trade": "CONCRETE",
                "volume_m3": round(vol, 3),
                "formwork_m2": round(side_area, 2),
                "estimated_rebar_kg": round(vol * REBAR_RATIO_KG_PER_M3["IfcFooting"], 2),
            })

        # 2. Columns
        columns = self.model.by_type("IfcColumn")
        for col in columns:
            vol = self._get_element_volume(col) or 0.45
            concrete_totals["columns_vol_m3"] += vol
            # Formwork: perimeter * height (approx 0.3x0.3m x 3m column => 4 * 0.3 * 3 = 3.6m2)
            col_formwork = max(1.2, vol * 9.0)
            formwork_totals["columns_formwork_m2"] += col_formwork
            elements_detail.append({
                "guid": col.GlobalId,
                "ifc_class": "IfcColumn",
                "name": col.Name or "RC Column",
                "trade": "CONCRETE",
                "volume_m3": round(vol, 3),
                "formwork_m2": round(col_formwork, 2),
                "estimated_rebar_kg": round(vol * REBAR_RATIO_KG_PER_M3["IfcColumn"], 2),
            })

        # 3. Beams
        beams = self.model.by_type("IfcBeam")
        for b in beams:
            vol = self._get_element_volume(b) or 0.60
            concrete_totals["beams_vol_m3"] += vol
            # Formwork: two sides + soffit (approx 2.5 * length)
            beam_formwork = max(1.5, vol * 7.5)
            formwork_totals["beams_formwork_m2"] += beam_formwork
            elements_detail.append({
                "guid": b.GlobalId,
                "ifc_class": "IfcBeam",
                "name": b.Name or "RC Beam",
                "trade": "CONCRETE",
                "volume_m3": round(vol, 3),
                "formwork_m2": round(beam_formwork, 2),
                "estimated_rebar_kg": round(vol * REBAR_RATIO_KG_PER_M3["IfcBeam"], 2),
            })

        # 4. Slabs
        slabs = self.model.by_type("IfcSlab")
        for slab in slabs:
            vol = self._get_element_volume(slab) or 3.5
            area = self._get_element_area(slab) or (vol / 0.150 if vol > 0 else 25.0)
            concrete_totals["slabs_vol_m3"] += vol
            formwork_totals["slabs_formwork_m2"] += area
            elements_detail.append({
                "guid": slab.GlobalId,
                "ifc_class": "IfcSlab",
                "name": slab.Name or "Suspended Slab",
                "trade": "CONCRETE",
                "volume_m3": round(vol, 3),
                "area_m2": round(area, 2),
                "formwork_m2": round(area, 2),
                "estimated_rebar_kg": round(vol * REBAR_RATIO_KG_PER_M3["IfcSlab"], 2),
            })

        # 5. Walls
        walls = self.model.by_type("IfcWall") or self.model.by_type("IfcWallStandardCase")
        for w in walls:
            vol = self._get_element_volume(w) or 1.2
            area = self._get_element_area(w) or (vol / 0.200 if vol > 0 else 6.0)
            walling_totals["walls_area_m2"] += area
            elements_detail.append({
                "guid": w.GlobalId,
                "ifc_class": "IfcWall",
                "name": w.Name or "Masonry / Concrete Wall",
                "trade": "WALLING",
                "volume_m3": round(vol, 3),
                "area_m2": round(area, 2),
            })

        # 6. Modeled Reinforcing Bars (IfcReinforcingBar)
        rebars = self.model.by_type("IfcReinforcingBar")
        if rebars:
            for bar in rebars:
                bar_len = getattr(bar, "BarLength", None) or 6.0
                bar_diam = getattr(bar, "NominalDiameter", None) or 16
                mass_per_m = REBAR_NOMINAL_MASS_KG_M.get(int(bar_diam), 1.58)
                bar_mass = bar_len * mass_per_m
                rebar_totals["modeled_rebar_kg"] += bar_mass
                d_key = f"T{int(bar_diam)}"
                rebar_totals["by_diameter"][d_key] = rebar_totals["by_diameter"].get(d_key, 0.0) + bar_mass
            rebar_totals["total_rebar_kg"] = rebar_totals["modeled_rebar_kg"]
        else:
            # Estimate rebar from concrete volumes
            est_footing = concrete_totals["footings_vol_m3"] * REBAR_RATIO_KG_PER_M3["IfcFooting"]
            est_col = concrete_totals["columns_vol_m3"] * REBAR_RATIO_KG_PER_M3["IfcColumn"]
            est_beam = concrete_totals["beams_vol_m3"] * REBAR_RATIO_KG_PER_M3["IfcBeam"]
            est_slab = concrete_totals["slabs_vol_m3"] * REBAR_RATIO_KG_PER_M3["IfcSlab"]
            est_total = est_footing + est_col + est_beam + est_slab
            rebar_totals["estimated_rebar_kg"] = round(est_total, 2)
            rebar_totals["total_rebar_kg"] = round(est_total, 2)
            # Rough standard breakdown across structural bar diameters (Kenyan practice)
            rebar_totals["by_diameter"] = {
                "T8": round(est_total * 0.12, 2),   # stirrups/links
                "T10": round(est_total * 0.15, 2),  # slab top/bottom
                "T12": round(est_total * 0.28, 2),  # slab / beam distribution
                "T16": round(est_total * 0.30, 2),  # column / beam main bars
                "T20": round(est_total * 0.15, 2),  # column / foundation heavy bars
            }

        # Totals
        concrete_totals["total_concrete_m3"] = round(
            concrete_totals["footings_vol_m3"] +
            concrete_totals["columns_vol_m3"] +
            concrete_totals["beams_vol_m3"] +
            concrete_totals["slabs_vol_m3"],
            2
        )
        formwork_totals["total_formwork_m2"] = round(
            formwork_totals["footings_formwork_m2"] +
            formwork_totals["columns_formwork_m2"] +
            formwork_totals["beams_formwork_m2"] +
            formwork_totals["slabs_formwork_m2"],
            2
        )

        self.extracted_elements = elements_detail
        self.summary_quantities = {
            "concrete_totals": concrete_totals,
            "formwork_totals": formwork_totals,
            "rebar_totals": rebar_totals,
            "walling_totals": walling_totals,
            "element_counts": {
                "footings": len(footings),
                "columns": len(columns),
                "beams": len(beams),
                "slabs": len(slabs),
                "walls": len(walls),
                "rebars": len(rebars),
            }
        }
        return self.summary_quantities

    def _get_element_volume(self, element) -> Optional[float]:
        """Attempts to read NetVolume or GrossVolume from IFC property sets."""
        try:
            psets = ifcopenshell.util.element.get_psets(element)
            for pset_name, props in psets.items():
                for k in ["NetVolume", "GrossVolume", "Volume"]:
                    if k in props and props[k] is not None:
                        val = float(props[k])
                        if val > 0:
                            return val
        except Exception:
            pass
        return None

    def _get_element_area(self, element) -> Optional[float]:
        """Attempts to read NetArea or GrossArea from IFC property sets."""
        try:
            psets = ifcopenshell.util.element.get_psets(element)
            for pset_name, props in psets.items():
                for k in ["NetSideArea", "NetArea", "GrossArea", "Area"]:
                    if k in props and props[k] is not None:
                        val = float(props[k])
                        if val > 0:
                            return val
        except Exception:
            pass
        return None

    # -------------------------------------------------------------------------
    # 2. BoQ Ingestion Helper
    # -------------------------------------------------------------------------
    @staticmethod
    def parse_boq_file(file_content: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Parses BoQ file from Excel (.xlsx) or CSV format.
        Expected columns: description, unit, quantity, rate (optional), amount (optional).
        """
        items = []
        fn = filename.lower()

        if fn.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                return []

            # Find header row
            header_idx = -1
            desc_col = unit_col = qty_col = rate_col = amount_col = -1

            for idx, r in enumerate(rows[:10]):
                r_strs = [str(cell).upper().strip() if cell is not None else "" for cell in r]
                for col_i, text in enumerate(r_strs):
                    if any(w in text for w in ["DESCRIPTION", "ITEM", "PARTICULARS"]):
                        desc_col = col_i
                    elif any(w in text for w in ["UNIT", "UOM"]):
                        unit_col = col_i
                    elif any(w in text for w in ["QTY", "QUANTITY"]):
                        qty_col = col_i
                    elif any(w in text for w in ["RATE", "PRICE", "UNIT RATE"]):
                        rate_col = col_i
                    elif any(w in text for w in ["AMOUNT", "TOTAL", "TOTAL COST"]):
                        amount_col = col_i
                if desc_col != -1 and qty_col != -1:
                    header_idx = idx
                    break

            # Fallback if no explicit header found
            if header_idx == -1:
                desc_col, unit_col, qty_col, rate_col = 0, 1, 2, 3
                header_idx = 0

            for r in rows[header_idx + 1:]:
                if not r or len(r) <= desc_col:
                    continue
                desc_val = str(r[desc_col]).strip() if r[desc_col] is not None else ""
                if not desc_val or len(desc_val) < 3 or desc_val.lower().startswith("total"):
                    continue

                unit_val = str(r[unit_col]).strip().upper() if unit_col != -1 and unit_col < len(r) and r[unit_col] else "ITEM"
                qty_val = 0.0
                try:
                    if qty_col != -1 and qty_col < len(r) and r[qty_col] is not None:
                        qty_val = float(str(r[qty_col]).replace(",", "").strip())
                except (ValueError, TypeError):
                    qty_val = 0.0

                rate_val = 0.0
                try:
                    if rate_col != -1 and rate_col < len(r) and r[rate_col] is not None:
                        rate_val = float(str(r[rate_col]).replace(",", "").strip())
                except (ValueError, TypeError):
                    rate_val = 0.0

                items.append({
                    "description": desc_val,
                    "unit": unit_val,
                    "quantity": qty_val,
                    "rate": rate_val,
                    "amount": round(qty_val * rate_val, 2)
                })

        elif fn.endswith(".csv"):
            text_data = file_content.decode("utf-8", errors="ignore")
            reader = csv.reader(io.StringIO(text_data))
            rows = list(reader)
            if not rows:
                return []
            header = [c.upper().strip() for c in rows[0]]
            desc_i = next((i for i, c in enumerate(header) if "DESC" in c or "ITEM" in c), 0)
            unit_i = next((i for i, c in enumerate(header) if "UNIT" in c), 1)
            qty_i = next((i for i, c in enumerate(header) if "QTY" in c or "QUANT" in c), 2)
            rate_i = next((i for i, c in enumerate(header) if "RATE" in c or "PRICE" in c), 3)

            for r in rows[1:]:
                if not r or len(r) <= desc_i:
                    continue
                d = r[desc_i].strip()
                if not d or len(d) < 3:
                    continue
                u = r[unit_i].strip().upper() if unit_i < len(r) else "ITEM"
                try:
                    q = float(r[qty_i].replace(",", "").strip()) if qty_i < len(r) else 0.0
                except ValueError:
                    q = 0.0
                try:
                    rate = float(r[rate_i].replace(",", "").strip()) if rate_i < len(r) else 0.0
                except ValueError:
                    rate = 0.0

                items.append({
                    "description": d,
                    "unit": u,
                    "quantity": q,
                    "rate": rate,
                    "amount": round(q * rate, 2)
                })

        return items

    # -------------------------------------------------------------------------
    # 3. Model vs BoQ Reconciliation & IQSK Benchmark Linking
    # -------------------------------------------------------------------------
    def reconcile(self) -> Dict[str, Any]:
        """
        Matches model elements with BoQ line items, detects discrepancies,
        and benchmarks against IQSK cost handbook rates.
        """
        if not self.summary_quantities:
            self.extract_model_quantities()

        reconciliation_items = []
        conc = self.summary_quantities["concrete_totals"]
        form = self.summary_quantities["formwork_totals"]
        rebar = self.summary_quantities["rebar_totals"]
        wall = self.summary_quantities["walling_totals"]

        # Standard Model Quantities to Reconcile
        model_qto_mapping = [
            # Trade: Concrete In-Situ
            {
                "key": "concrete_columns",
                "trade": "CONCRETE",
                "name": "Vibrated Reinforced Concrete Class 25/20 in Columns",
                "unit": "CM",
                "model_qty": conc["columns_vol_m3"],
                "search_keywords": ["concrete", "column", "columns"],
            },
            {
                "key": "concrete_beams",
                "trade": "CONCRETE",
                "name": "Vibrated Reinforced Concrete Class 25/20 in Beams",
                "unit": "CM",
                "model_qty": conc["beams_vol_m3"],
                "search_keywords": ["concrete", "beam", "beams"],
            },
            {
                "key": "concrete_slabs",
                "trade": "CONCRETE",
                "name": "Vibrated Reinforced Concrete Class 25/20 in Suspended Slabs",
                "unit": "CM",
                "model_qty": conc["slabs_vol_m3"],
                "search_keywords": ["concrete", "slab", "slabs", "suspended"],
            },
            {
                "key": "concrete_footings",
                "trade": "CONCRETE",
                "name": "Vibrated Reinforced Concrete Class 20/20 in Strip & Pad Footings",
                "unit": "CM",
                "model_qty": conc["footings_vol_m3"],
                "search_keywords": ["footing", "footings", "foundation", "base"],
            },
            # Trade: Formwork
            {
                "key": "formwork_columns",
                "trade": "FORMWORK",
                "name": "Sawn Formwork to Vertical Sides of Columns",
                "unit": "SM",
                "model_qty": form["columns_formwork_m2"],
                "search_keywords": ["formwork", "column", "columns", "shuttering"],
            },
            {
                "key": "formwork_beams",
                "trade": "FORMWORK",
                "name": "Sawn Formwork to Sides and Soffits of Beams",
                "unit": "SM",
                "model_qty": form["beams_formwork_m2"],
                "search_keywords": ["formwork", "beam", "beams", "soffit"],
            },
            {
                "key": "formwork_slabs",
                "trade": "FORMWORK",
                "name": "Sawn Formwork to Soffits of Suspended Slabs",
                "unit": "SM",
                "model_qty": form["slabs_formwork_m2"],
                "search_keywords": ["formwork", "slab", "slabs", "decking"],
            },
            # Trade: Reinforcement (by diameter)
            {
                "key": "rebar_t16",
                "trade": "REINFORCEMENT",
                "name": "High Tensile Ribbed Reinforcement Bars 16mm (T16)",
                "unit": "KG",
                "model_qty": rebar["by_diameter"].get("T16", 0.0),
                "search_keywords": ["16mm", "t16", "y16", "ribbed", "reinforcement"],
            },
            {
                "key": "rebar_t12",
                "trade": "REINFORCEMENT",
                "name": "High Tensile Ribbed Reinforcement Bars 12mm (T12)",
                "unit": "KG",
                "model_qty": rebar["by_diameter"].get("T12", 0.0),
                "search_keywords": ["12mm", "t12", "y12", "ribbed", "reinforcement"],
            },
            {
                "key": "rebar_t10",
                "trade": "REINFORCEMENT",
                "name": "High Tensile Ribbed Reinforcement Bars 10mm (T10)",
                "unit": "KG",
                "model_qty": rebar["by_diameter"].get("T10", 0.0),
                "search_keywords": ["10mm", "t10", "y10", "reinforcement"],
            },
            {
                "key": "rebar_t8",
                "trade": "REINFORCEMENT",
                "name": "High Tensile Ribbed Reinforcement Bars 8mm (T8)",
                "unit": "KG",
                "model_qty": rebar["by_diameter"].get("T8", 0.0),
                "search_keywords": ["8mm", "t8", "y8", "stirrups", "links"],
            },
            # Trade: Walling
            {
                "key": "walling_masonry",
                "trade": "WALLING",
                "name": "200mm Machine Cut Stone Walling / Concrete Block",
                "unit": "SM",
                "model_qty": wall["walls_area_m2"],
                "search_keywords": ["stone", "walling", "blocks", "masonry"],
            },
        ]

        matched_boq_indices = set()

        for target in model_qto_mapping:
            model_qty = target["model_qty"]
            unit = target["unit"]
            trade = target["trade"]
            keywords = target["search_keywords"]

            # Match against BoQ items
            boq_qty = 0.0
            boq_rate = 0.0
            matched_item_name = ""

            for i, bi in enumerate(self.boq_items):
                if i in matched_boq_indices:
                    continue
                desc_lower = bi["description"].lower()
                # Check keyword overlap
                match_count = sum(1 for kw in keywords if kw in desc_lower)
                if match_count >= 2 or (len(keywords) == 1 and match_count == 1):
                    boq_qty += float(bi["quantity"])
                    if bi.get("rate") and float(bi["rate"]) > 0:
                        boq_rate = float(bi["rate"])
                    matched_item_name = bi["description"]
                    matched_boq_indices.add(i)

            # Compute Discrepancy & Status
            delta_qty = round(boq_qty - model_qty, 2)
            if model_qty > 0:
                variance_pct = round((delta_qty / model_qty) * 100.0, 1)
            elif boq_qty > 0:
                variance_pct = 100.0
            else:
                variance_pct = 0.0

            if model_qty > 0 and boq_qty == 0:
                status = "OMISSION"
                status_label = "Drawing Omission in BoQ"
                severity = "critical"
            elif model_qty == 0 and boq_qty > 0:
                status = "PHANTOM_ITEM"
                status_label = "Item Claimed but Absent from Model"
                severity = "warning"
            elif abs(variance_pct) <= 2.0:
                status = "MATCHED"
                status_label = "Verified Match (<=2%)"
                severity = "success"
            elif abs(variance_pct) <= 10.0:
                status = "TOLERABLE_VARIANCE"
                status_label = "Tolerable Variance (Laps/Wastage)"
                severity = "info"
            else:
                status = "CRITICAL_DISCREPANCY"
                status_label = f"Discrepancy ({variance_pct:+.1f}%)"
                severity = "critical"

            # Benchmark against IQSK Handbook Rates
            iqsk_rate = self._find_iqsk_rate(trade, target["name"], unit)
            tender_amount = round(boq_qty * boq_rate, 2)
            iqsk_amount = round(model_qty * iqsk_rate, 2)
            # Financial exposure: overclaim or variance cost
            financial_exposure = round(tender_amount - iqsk_amount, 2)

            reconciliation_items.append({
                "key": target["key"],
                "trade": trade,
                "name": target["name"],
                "boq_matched_desc": matched_item_name or target["name"],
                "unit": unit,
                "model_qty": round(model_qty, 2),
                "boq_qty": round(boq_qty, 2),
                "delta_qty": delta_qty,
                "variance_pct": variance_pct,
                "status": status,
                "status_label": status_label,
                "severity": severity,
                "boq_rate": round(boq_rate, 2),
                "iqsk_rate": round(iqsk_rate, 2),
                "tender_amount": tender_amount,
                "iqsk_benchmark_amount": iqsk_amount,
                "financial_exposure": financial_exposure,
            })

        # Summary KPIs
        total_items = len(reconciliation_items)
        matched_items = sum(1 for it in reconciliation_items if it["status"] in ["MATCHED", "TOLERABLE_VARIANCE"])
        critical_items = sum(1 for it in reconciliation_items if it["status"] == "CRITICAL_DISCREPANCY")
        omissions = sum(1 for it in reconciliation_items if it["status"] == "OMISSION")

        total_tender_sum = sum(it["tender_amount"] for it in reconciliation_items)
        total_iqsk_sum = sum(it["iqsk_benchmark_amount"] for it in reconciliation_items)
        net_exposure = round(total_tender_sum - total_iqsk_sum, 2)

        match_rate = round((matched_items / total_items) * 100.0, 1) if total_items > 0 else 0.0

        return {
            "summary_kpis": {
                "total_items_audited": total_items,
                "matched_count": matched_items,
                "critical_discrepancies": critical_items,
                "omissions_detected": omissions,
                "match_rate_pct": match_rate,
                "total_tender_amount": total_tender_sum,
                "total_iqsk_benchmark": total_iqsk_sum,
                "net_financial_exposure": net_exposure,
                "currency": "KES"
            },
            "physical_summary": self.summary_quantities,
            "audit_matrix": reconciliation_items,
        }

    def _find_iqsk_rate(self, trade: str, description: str, unit: str) -> float:
        """
        Finds the closest benchmark rate in the IQSKCostRate database.
        Falls back to national average handbook default if exact DB match is not yet seeded.
        """
        # Baseline Fallback Rates from IQSK 2023-2024 Handbook
        defaults = {
            ("CONCRETE", "CM"): 15_500.0,    # Vibrated reinforced concrete class 25/20
            ("FORMWORK", "SM"): 610.0,       # Sawn timber formwork
            ("REINFORCEMENT", "KG"): 225.0,  # High tensile ribbed bars T8-T25
            ("WALLING", "SM"): 2_150.0,      # 200mm stone / concrete block walling
            ("EARTHWORKS", "CM"): 480.0,     # Excavation & hardcore filling
            ("ROOFING", "SM"): 2_400.0,      # Interlocking concrete roofing tiles
        }

        try:
            # Query Django DB
            qs = IQSKCostRate.objects.filter(trade=trade, unit=unit)
            if qs.exists():
                # Try description keyword match
                desc_words = [w.lower() for w in re.findall(r'\b[A-Za-z0-9]{3,}\b', description)]
                best_match = None
                best_score = -1
                for rate_obj in qs[:50]:
                    r_desc = rate_obj.description.lower()
                    score = sum(1 for w in desc_words if w in r_desc)
                    if score > best_score:
                        best_score = score
                        best_match = rate_obj

                if best_match and float(best_match.rate_kes) > 0:
                    return float(best_match.rate_kes)
                # First rate in trade
                first = qs.first()
                if first and float(first.rate_kes) > 0:
                    return float(first.rate_kes)
        except Exception:
            pass

        return defaults.get((trade, unit), 1_500.0)
