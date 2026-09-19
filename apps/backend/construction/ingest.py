"""
Excel and PDF ingestion engine for Work Plan and Bill of Quantities.

Supports:
  1. Work Plan — hierarchical WBS (VertexMandera-compatible) or flat task list
  2. Bill of Quantities — sectioned BoQ with intelligent header detection and summary-row filtering
  3. Auto-generation of weekly MilestoneEntry records for mobile site progress tracking
  4. Template downloads:
     - GET /templates/workplan (.xlsx)
     - GET /templates/boq      (.xlsx)
"""
import datetime
from decimal import Decimal
import io
import json
import re
import time
import uuid

from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.tenancy import get_active_organization
from .models import BoQItem, MilestoneEntry, Project, WorkPlanTask


# ── Styling & Formatting Constants ──────────────────────────────────────────

THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"),
)
HEADER_FILL = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)


def _style_header(ws, row=1, max_col=10):
    for col in range(1, max_col + 1):
        cell = ws.cell(row, col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER


def _style_data_rows(ws, start_row=2, max_col=10):
    for row in ws.iter_rows(min_row=start_row, max_col=max_col):
        for cell in row:
            cell.border = THIN_BORDER
            cell.alignment = Alignment(wrap_text=True, vertical="top")


def _now_ms() -> int:
    return int(time.time() * 1000)


# ── Template Generators ──────────────────────────────────────────────────────

def generate_workplan_template() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Workplan"

    headers = [
        "Task ID", "Task Name", "Start Date", "Finish Date",
        "Duration (days)", "Predecessors", "Resource", "Progress (%)",
    ]
    for col, h in enumerate(headers, 1):
        ws.cell(1, col, h)
    _style_header(ws, max_col=len(headers))

    widths = [12, 44, 14, 14, 14, 14, 24, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    tasks = [
        ("1", "Site Establishment & Mobilisation", "2026-05-01", "2026-05-10", 10, "", "Project Manager", 100),
        ("2", "Site Clearance & Topsoil Stripping", "2026-05-11", "2026-05-20", 10, "1", "Civil Team", 100),
        ("3", "Excavation & Bulk Earthworks", "2026-05-21", "2026-06-05", 16, "2", "Civil Team", 75),
        ("4", "Foundation Concrete & Waterproofing", "2026-06-06", "2026-06-25", 20, "3", "Concrete Team", 50),
        ("5", "Ground Floor Slab & Curing", "2026-06-26", "2026-07-10", 15, "4", "Concrete Team", 30),
        ("6", "Superstructure Columns & Beams (G.Floor)", "2026-07-11", "2026-08-05", 26, "5", "Structural Team", 10),
        ("7", "First Floor Slab & Staircase", "2026-08-06", "2026-08-25", 20, "6", "Structural Team", 0),
        ("8", "Superstructure Columns & Beams (1st Floor)", "2026-08-26", "2026-09-15", 21, "7", "Structural Team", 0),
        ("9", "Roof Slab & Waterproofing", "2026-09-16", "2026-10-05", 20, "8", "Structural Team", 0),
        ("10", "External Walling & Plastering", "2026-10-06", "2026-10-25", 20, "9", "Masonry Team", 0),
        ("11", "Internal Finishes (Plaster, Tiling, Painting)", "2026-10-26", "2026-11-20", 26, "10", "Finishing Team", 0),
        ("12", "Doors, Windows & Glazing Installation", "2026-11-21", "2026-12-10", 20, "11", "Finishing Team", 0),
        ("13", "MEP Installations (Electrical, Plumbing, HVAC)", "2026-11-01", "2026-12-15", 45, "10", "MEP Team", 0),
        ("14", "External Works, Landscaping & Handover", "2026-12-16", "2027-01-15", 31, "12,13", "Project Manager", 0),
    ]
    for i, task in enumerate(tasks, 2):
        for col, val in enumerate(task, 1):
            ws.cell(i, col, val)

    _style_data_rows(ws, start_row=2, max_col=len(headers))

    instr = wb.create_sheet("Instructions")
    instr.cell(1, 1, "Work Plan Template — Instructions")
    instr.cell(1, 1).font = Font(bold=True, size=14)
    instructions = [
        "Upload this spreadsheet to establish your Master Work Programme.",
        "The system will parse tasks and automatically generate weekly milestones for mobile tracking.",
        "",
        "Guidelines:",
        "  - Ensure Task IDs are unique",
        "  - Use YYYY-MM-DD or DD/MM/YYYY date formatting",
        "  - Predecessors can be comma-separated task IDs (e.g. 1,2)",
    ]
    for i, line in enumerate(instructions, 3):
        instr.cell(i, 1, line)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_boq_template() -> bytes:
    wb = openpyxl.Workbook()
    ws_first = wb.active
    ws_first.title = "Summary"

    sections_data = {
        "Preliminaries": [
            ("0.1", "Site establishment, security hoarding & mobilisation", "Item", 1, 8000000),
            ("0.2", "Temporary utilities (water, power, comms)", "Item", 1, 3000000),
            ("0.3", "Contractor performance bonds & insurance", "Item", 1, 4500000),
            ("0.4", "Health & safety management, signage & PPE", "Item", 1, 1500000),
            ("0.5", "Perimeter scaffolding & safety netting", "m2", 2500, 1800),
        ],
        "Substructure": [
            ("1.1", "Site clearance and topsoil stripping (150mm)", "m2", 2000, 150),
            ("1.2", "Bulk excavation in normal soil to reduced level", "m3", 5000, 800),
            ("1.3", "Disposal of excavated material off site", "m3", 3000, 500),
            ("1.4", "Hardcore filling and compaction in 150mm layers", "m3", 2500, 2000),
            ("1.5", "Sand blinding bed (50mm thick)", "m2", 2000, 500),
            ("1.6", "Heavy-gauge polythene damp proof membrane (DPM)", "m2", 2000, 400),
            ("1.7", "Mass concrete blinding (Class 15/20)", "m3", 300, 12000),
            ("1.8", "Vibrated reinforced concrete in pad foundations (RC 30)", "m3", 1200, 85000),
            ("1.9", "High-yield ribbed steel reinforcement (Y12-Y20)", "Ton", 350, 120000),
            ("1.10", "Sawn formwork to foundation column bases", "m2", 4000, 2500),
            ("1.11", "Ground floor slab concrete (RC 30, 150mm)", "m2", 2000, 4500),
            ("1.12", "BRC A142 steel fabric mesh reinforcement", "m2", 2000, 1200),
        ],
        "Superstructure": [
            ("2.1", "RC suspended floor slabs (Class 30)", "m2", 15000, 7500),
            ("2.2", "RC framed beams and lintels", "m3", 1200, 85000),
            ("2.3", "RC framed structural columns", "m3", 900, 90000),
            ("2.4", "High tensile ribbed reinforcement (Y16-Y25)", "Ton", 1800, 120000),
            ("2.5", "Marine plywood formwork to soffits & sides", "m2", 45000, 2500),
            ("2.6", "Reinforced concrete staircases and landings", "No", 8, 450000),
            ("2.7", "Roof slab concrete and torch-on APP waterproofing", "m2", 1500, 8500),
        ],
        "Finishes": [
            ("3.1", "Internal cement-sand wall plastering (15mm)", "m2", 40000, 800),
            ("3.2", "External wall rendering and tyrolean finish (20mm)", "m2", 15000, 1200),
            ("3.3", "Non-slip porcelain floor tiles with grout", "m2", 18000, 3500),
            ("3.4", "Glazed ceramic bathroom wall tiles", "m2", 5000, 4000),
            ("3.5", "Acoustic mineral fiber suspended ceilings", "m2", 15000, 2500),
            ("3.6", "Three coats silk vinyl emulsion paint", "m2", 50000, 600),
            ("3.7", "Solid mahogany fire-rated flush doors", "No", 600, 25000),
            ("3.8", "Powder-coated aluminium framed windows", "m2", 1200, 18000),
        ],
        "MEP": [
            ("4.1", "Complete electrical wiring, distribution boards & fittings", "m2", 15000, 2500),
            ("4.2", "Internal drainage, water supply & sanitary appliances", "m2", 15000, 2000),
            ("4.3", "VRF air conditioning and mechanical ventilation", "m2", 15000, 3500),
            ("4.4", "High-speed passenger elevators (10-passenger)", "No", 3, 12000000),
            ("4.5", "Automatic addressable fire detection & sprinkler system", "Item", 1, 15000000),
        ],
        "External": [
            ("5.1", "Heavy-duty cabro paving blocks to driveways", "m2", 5000, 2000),
            ("5.2", "Storm water drainage channels and culverts", "Item", 1, 8000000),
            ("5.3", "Masonry boundary perimeter wall with razor wire", "ml", 300, 25000),
            ("5.4", "Soft landscaping, turfing and ornamental trees", "m2", 3000, 1500),
        ],
    }

    summary_rows = []
    headers = ["Item No", "Description", "Unit", "Qty", "Rate (KES)", "Amount (KES)"]

    for sec_name, items in sections_data.items():
        ws = wb.create_sheet(sec_name)
        for col, h in enumerate(headers, 1):
            ws.cell(1, col, h)
        _style_header(ws, max_col=len(headers))

        total_sec = 0
        for i, row_data in enumerate(items, 2):
            item_no, desc, unit, qty, rate = row_data
            amt = (qty * rate) if (qty is not None and rate is not None) else None
            if amt:
                total_sec += amt
            ws.cell(i, 1, item_no)
            ws.cell(i, 2, desc)
            ws.cell(i, 3, unit)
            ws.cell(i, 4, qty)
            ws.cell(i, 5, rate)
            ws.cell(i, 6, amt)

        _style_data_rows(ws, start_row=2, max_col=len(headers))
        for col_idx, width in enumerate([12, 55, 12, 12, 16, 18], 1):
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        summary_rows.append((sec_name, total_sec))

    # Fill Summary Sheet
    sum_headers = ["Section", "Section Description", "Subtotal Amount (KES)"]
    for col, h in enumerate(sum_headers, 1):
        ws_first.cell(1, col, h)
    _style_header(ws_first, max_col=len(sum_headers))
    grand_total = 0
    for idx, (sname, subtotal) in enumerate(summary_rows, 2):
        ws_first.cell(idx, 1, str(idx - 1))
        ws_first.cell(idx, 2, f"Total for {sname}")
        ws_first.cell(idx, 3, subtotal)
        grand_total += subtotal
    tot_row = len(summary_rows) + 2
    ws_first.cell(tot_row, 2, "GRAND SUMMARY TOTAL")
    ws_first.cell(tot_row, 3, grand_total)
    ws_first.cell(tot_row, 2).font = Font(bold=True)
    ws_first.cell(tot_row, 3).font = Font(bold=True)
    _style_data_rows(ws_first, start_row=2, max_col=len(sum_headers))
    ws_first.column_dimensions["A"].width = 12
    ws_first.column_dimensions["B"].width = 40
    ws_first.column_dimensions["C"].width = 24

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Parsing Utilities ────────────────────────────────────────────────────────

def _parse_date(val):
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, datetime.date):
        return val
    if isinstance(val, str):
        val = val.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                return datetime.datetime.strptime(val, fmt).date()
            except ValueError:
                pass
        try:
            return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(val)))
        except (TypeError, ValueError, OverflowError):
            pass
    if isinstance(val, (int, float)):
        try:
            return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(val))
        except (OverflowError, ValueError):
            pass
    return None


def _parse_float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_decimal(val):
    if val is None or val == "":
        return None
    try:
        clean = str(val).replace(",", "").strip()
        return Decimal(clean)
    except Exception:
        return None


def _is_summary_row(desc: str) -> bool:
    if not desc:
        return False
    d = desc.lower().strip()
    return any(p in d for p in (
        "total", "carried to", "carried forward", "brought forward",
        "collection", "summary of", "subtotal", "balance c/f", "balance b/f",
    ))


def _classify_sheet_section(sheet_name: str) -> str:
    s = sheet_name.lower().strip()
    if any(k in s for k in ("prelim", "general", "mobilis", "mobiliz", "bond", "insurance")):
        return "preliminaries"
    if any(k in s for k in ("substruct", "foundation", "earthwork", "ground", "excavat", "piling")):
        return "substructure"
    if any(k in s for k in ("superstruct", "concrete", "masonry", "wall", "slab", "frame", "beam", "column", "roof")):
        return "superstructure"
    if any(k in s for k in ("finish", "plaster", "tile", "paint", "floor", "ceiling", "door", "window", "glaz", "joiner")):
        return "finishes"
    if any(k in s for k in ("mep", "electric", "plumb", "drain", "hvac", "mechanic", "fire", "alarm", "lift")):
        return "mep"
    if any(k in s for k in ("extern", "landscape", "paving", "fence", "gate", "civil", "road", "cabro")):
        return "external"
    return "general"


def _find_boq_header(ws):
    """Dynamically detects the header row and column mappings in a worksheet."""
    max_scan = min(ws.max_row or 15, 15)
    for r in range(1, max_scan + 1):
        row_vals = [str(cell.value or "").strip().lower() for cell in ws[r]]
        has_desc = any(any(k in v for k in ("description", "particulars", "specification", "item desc")) for v in row_vals)
        has_qty = any(any(k in v for k in ("qty", "quantity", "quantities")) for v in row_vals)
        has_rate = any(any(k in v for k in ("rate", "unit rate", "price")) for v in row_vals)

        if has_desc or (has_qty and has_rate):
            mapping = {"item": 0, "desc": 1, "unit": 2, "qty": 3, "rate": 4, "amount": 5, "start_row": r + 1}
            for idx, v in enumerate(row_vals):
                if any(k in v for k in ("item", "no", "code", "ref")):
                    mapping["item"] = idx
                elif any(k in v for k in ("desc", "particular")):
                    mapping["desc"] = idx
                elif "unit" in v:
                    mapping["unit"] = idx
                elif any(k in v for k in ("qty", "quant")):
                    mapping["qty"] = idx
                elif "rate" in v:
                    mapping["rate"] = idx
                elif any(k in v for k in ("amount", "total", "cost")):
                    mapping["amount"] = idx
            return mapping
    return {"item": 0, "desc": 1, "unit": 2, "qty": 3, "rate": 4, "amount": 5, "start_row": 2}


# ── BoQ and Workplan Parsers ────────────────────────────────────────────────

def _preview_boq_sheet(ws, section: str):
    items = []
    col_map = _find_boq_header(ws)
    for row in ws.iter_rows(min_row=col_map["start_row"], values_only=True):
        if not row:
            continue
        desc_idx = col_map["desc"]
        if desc_idx >= len(row) or not row[desc_idx]:
            continue
        desc = str(row[desc_idx]).strip()
        if _is_summary_row(desc):
            continue

        item_idx = col_map["item"]
        item_no = str(row[item_idx] or "").strip() if item_idx < len(row) else ""

        unit_idx = col_map["unit"]
        unit = str(row[unit_idx] or "").strip() if unit_idx < len(row) else ""

        qty_idx = col_map["qty"]
        qty = _parse_float(row[qty_idx]) if qty_idx < len(row) else None

        rate_idx = col_map["rate"]
        rate = _parse_decimal(row[rate_idx]) if rate_idx < len(row) else None

        amt_idx = col_map["amount"]
        amt = _parse_decimal(row[amt_idx]) if amt_idx < len(row) else None
        if amt is None and qty is not None and rate is not None:
            amt = Decimal(str(round(qty * float(rate), 2)))

        items.append({
            "section": section,
            "item_number": item_no,
            "description": desc,
            "unit": unit,
            "quantity": qty,
            "rate": float(rate) if rate is not None else None,
            "amount": float(amt) if amt is not None else None,
        })
    return items


def _preview_tasks_sheet(ws):
    tasks = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        task_id = str(int(row[0])) if isinstance(row[0], (int, float)) else str(row[0]).strip()
        name = str(row[1] or "").strip() if len(row) > 1 else ""
        if not name or _is_summary_row(name):
            continue
        start_val = str(row[2] or "").strip() if len(row) > 2 else ""
        end_val = str(row[3] or "").strip() if len(row) > 3 else ""
        duration = int(float(row[4])) if len(row) > 4 and row[4] is not None else 0
        predecessors = str(row[5] or "").strip() if len(row) > 5 else ""
        resource = str(row[6] or "").strip() if len(row) > 6 else ""
        tasks.append({
            "task_id": task_id,
            "task_name": name,
            "start_date": str(_parse_date(start_val) or start_val),
            "end_date": str(_parse_date(end_val) or end_val),
            "duration_days": duration,
            "predecessors": predecessors,
            "resource": resource,
            "wbs_level": 0,
        })
    return tasks


def generate_weekly_milestones_for_project(project, organization, now_ms_stamp: int):
    tasks = WorkPlanTask.objects.filter(project=project).order_by("start_date")
    entries = []
    for task in tasks:
        current = task.start_date
        week = 1
        while current <= task.end_date:
            label = f"Week {week}: {task.task_name}"
            entries.append(MilestoneEntry(
                id=str(uuid.uuid4()),
                project_id=str(project.id),
                organization=organization,
                milestone_id=label,
                percent_complete=0,
                created_at=now_ms_stamp,
                updated_at=now_ms_stamp,
            ))
            current += datetime.timedelta(days=7)
            week += 1
    if entries:
        MilestoneEntry.objects.bulk_create(entries)
    return entries


# ── HTTP Views & Endpoints ──────────────────────────────────────────────────

@csrf_exempt
def download_workplan_template(request):
    data = generate_workplan_template()
    resp = HttpResponse(
        data,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="workplan_template.xlsx"'
    return resp


@csrf_exempt
def download_boq_template(request):
    data = generate_boq_template()
    resp = HttpResponse(
        data,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="boq_template.xlsx"'
    return resp


@api_view(["POST"])
def ingestion_preview(request, project_id: str):
    """Parses uploaded Excel Work Plan and/or BoQ and returns preview JSON."""
    organization = get_active_organization(request)
    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    file = request.FILES.get("file")
    if not file:
        return Response({"error": "No file uploaded"}, status=400)

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file.read()), data_only=True)
    except Exception as e:
        return Response({"error": f"Invalid Excel spreadsheet: {str(e)}"}, status=400)

    result = {"work_plan_tasks": [], "boq_items": []}

    # Check for hierarchical WBS (VertexMandera layout)
    ws = wb.active
    is_hierarchical = (
        ws.max_column >= 14
        and str(ws.cell(1, 1).value or "").strip().lower() in ("task id", "task_id", "id")
    )

    if is_hierarchical:
        rows = list(ws.iter_rows(min_row=3, values_only=True))
        ancestors = [""] * 6
        for row in rows:
            if not row or not row[0]:
                continue
            task_id = str(int(row[0])) if isinstance(row[0], (int, float)) else str(row[0]).strip()
            # WBS level from column offset
            level = 0
            name = ""
            for lvl in range(6):
                idx = lvl + 1
                if idx < len(row) and row[idx] and str(row[idx]).strip():
                    level = lvl
                    name = str(row[idx]).strip()
                    break
            if not name or _is_summary_row(name):
                continue
            ancestors[level] = name
            for i in range(level + 1, 6):
                ancestors[i] = ""
            full_name = " / ".join([a for a in ancestors if a])

            duration = int(row[7]) if len(row) > 7 and row[7] else 0
            start_date = _parse_date(row[8]) if len(row) > 8 else None
            end_date = _parse_date(row[9]) if len(row) > 9 else None
            pct = float(row[13]) if len(row) > 13 and row[13] else 0

            result["work_plan_tasks"].append({
                "task_id": task_id,
                "task_name": full_name,
                "start_date": str(start_date) if start_date else "",
                "end_date": str(end_date) if end_date else "",
                "duration_days": duration,
                "percent_complete": pct,
                "wbs_level": level,
            })
    else:
        # Check for standard work plan sheet
        for name in wb.sheetnames:
            s_clean = name.strip().lower()
            if "work" in s_clean or "plan" in s_clean or "schedule" in s_clean or "programme" in s_clean:
                tasks = _preview_tasks_sheet(wb[name])
                if tasks:
                    result["work_plan_tasks"].extend(tasks)

    # Parse BoQ sheets
    for name in wb.sheetnames:
        s_clean = name.strip().lower()
        if any(skip in s_clean for skip in ("instruction", "readme", "work", "plan", "programme", "schedule")):
            continue
        section = _classify_sheet_section(name)
        items = _preview_boq_sheet(wb[name], section)
        if items:
            result["boq_items"].extend(items)

    return Response(result, status=200)


@api_view(["POST"])
def ingest_commit_json(request, project_id: str):
    """Commits pre-parsed Work Plan tasks and/or BoQ items into database records."""
    organization = get_active_organization(request)
    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    now = _now_ms()
    data = request.data or {}
    wp_data = data.get("work_plan_tasks")
    boq_data = data.get("boq_items")

    res = {
        "work_plan_tasks": 0,
        "boq_items": 0,
        "milestones_created": 0,
        "status": "committed",
    }

    with transaction.atomic():
        if isinstance(wp_data, list):
            WorkPlanTask.objects.filter(project=project).delete()
            tasks = []
            for t in wp_data:
                task_id = str(t.get("task_id") or uuid.uuid4().hex[:8])
                task_name = str(t.get("task_name") or "").strip()
                if not task_name:
                    continue
                start = _parse_date(t.get("start_date")) or datetime.date.today()
                end = _parse_date(t.get("end_date")) or datetime.date.today()
                duration = int(t.get("duration_days") or 0)
                tasks.append(WorkPlanTask(
                    project=project,
                    organization=organization,
                    task_id=task_id,
                    task_name=task_name,
                    start_date=start,
                    end_date=end,
                    duration_days=duration,
                    predecessors=str(t.get("predecessors") or ""),
                    resource=str(t.get("resource") or ""),
                    responsible_party=str(t.get("responsible_party") or t.get("resource") or ""),
                    percent_complete=Decimal(str(t.get("percent_complete") or 0)),
                    wbs_level=int(t.get("wbs_level") or 0),
                    approval_status="approved",
                ))
            if tasks:
                WorkPlanTask.objects.bulk_create(tasks)
                res["work_plan_tasks"] = len(tasks)
                milestones = generate_weekly_milestones_for_project(project, organization, now)
                res["milestones_created"] = len(milestones)

        if isinstance(boq_data, list):
            BoQItem.objects.filter(project=project).delete()
            items = []
            for b in boq_data:
                desc = str(b.get("description") or "").strip()
                if not desc:
                    continue
                qty = _parse_decimal(b.get("quantity"))
                rate = _parse_decimal(b.get("rate"))
                amt = _parse_decimal(b.get("amount"))
                if amt is None and qty is not None and rate is not None:
                    amt = Decimal(str(round(float(qty) * float(rate), 2)))

                items.append(BoQItem(
                    project=project,
                    organization=organization,
                    section=str(b.get("section") or "general"),
                    item_number=str(b.get("item_number") or ""),
                    description=desc,
                    unit=str(b.get("unit") or ""),
                    quantity=qty,
                    rate=rate,
                    amount=amt,
                    approval_status="approved",
                    cost_state="budgeted",
                ))
            if items:
                BoQItem.objects.bulk_create(items)
                res["boq_items"] = len(items)

    return Response(res, status=200)


@api_view(["GET"])
def ingestion_status(request, project_id: str):
    organization = get_active_organization(request)
    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    tasks_qs = WorkPlanTask.objects.filter(project=project)
    boq_qs = BoQItem.objects.filter(project=project)

    tasks = list(tasks_qs.values("id", "task_id", "task_name", "start_date", "end_date", "percent_complete"))
    boq_items = list(boq_qs.values("id", "section", "item_number", "description", "unit", "quantity", "rate", "amount", "cost_state"))

    return Response({
        "boq_item_count": len(boq_items),
        "work_plan_task_count": len(tasks),
        "boq_items": boq_items,
        "work_plan_tasks": tasks,
    }, status=200)


@api_view(["POST"])
def generate_milestones_endpoint(request, project_id: str):
    organization = get_active_organization(request)
    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    entries = generate_weekly_milestones_for_project(project, organization, _now_ms())
    return Response({"ok": True, "milestones_created": len(entries)}, status=200)


@api_view(["POST"])
def convert_project_pdf(request):
    """Extracts BoQ line items and work-plan tasks from an uploaded tender PDF."""
    organization = get_active_organization(request)
    project_id = request.data.get("project_id") or request.query_params.get("project_id")
    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    uploaded = request.FILES.get("file")
    if not uploaded:
        return Response({"error": "PDF file required"}, status=400)

    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(uploaded.read()))
        pages_text = [page.extract_text() or "" for page in reader.pages[:40]]
        source = "\n\n".join(pages_text).strip()
    except Exception as e:
        return Response({"error": f"Failed to extract PDF text: {str(e)}"}, status=400)

    if len(source) < 30:
        return Response({"error": "No readable text found in PDF"}, status=400)

    boq_items = []
    line_pattern = re.compile(
        r"^(?P<item>[0-9A-Z]+(?:\.[0-9A-Z]+)*)\s+(?P<desc>.+?)\s+(?P<unit>[a-zA-Z0-9/]+)\s+(?P<qty>[0-9,]+(?:\.[0-9]+)?)\s+(?P<rate>[0-9,]+(?:\.[0-9]+)?)\s+(?P<amount>[0-9,]+(?:\.[0-9]+)?)",
        re.MULTILINE,
    )
    for match in line_pattern.finditer(source):
        d = match.groupdict()
        desc = d["desc"].strip()
        if _is_summary_row(desc):
            continue
        qty = _parse_float(d["qty"])
        rate = _parse_decimal(d["rate"])
        amt = _parse_decimal(d["amount"])
        boq_items.append({
            "section": _classify_sheet_section(desc),
            "item_number": d["item"].strip(),
            "description": desc,
            "unit": d["unit"].strip(),
            "quantity": qty,
            "rate": float(rate) if rate else None,
            "amount": float(amt) if amt else None,
        })

    return Response({
        "project_id": project.id,
        "boq_items": boq_items,
        "work_plan_tasks": [],
        "requires_review": True,
    }, status=200)
