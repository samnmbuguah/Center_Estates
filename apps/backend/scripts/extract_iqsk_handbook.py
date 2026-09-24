#!/usr/bin/env python3
"""
IQSK Cost Handbook 2023-2024 Extraction & Ingestion Engine.
Extracts all construction trade rates from the scanned IQSK Handbook (166 pages),
structures the items into normalized trades, units, and regional rates,
exports versioned JSON and CSV artifacts, and populates the database.
"""
import os
import sys
import re
import json
import csv
import argparse
import subprocess
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

# Limit OpenMP threads per process to prevent thread contention
os.environ["OMP_THREAD_LIMIT"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

# Setup Django Environment if running directly
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

try:
    import django
    django.setup()
    from construction.models import IQSKCostRate
    HAS_DJANGO = True
except Exception as e:
    HAS_DJANGO = False
    print(f"Warning: Django not initialized directly ({e}). Running in standalone export mode.")

PDF_DEFAULT_PATH = "/root/Dev/Center_Estates/937126954-IQSK-Cost-Handbook-2023-2024.pdf"
DATA_DIR = BASE_DIR / "data"
PAGES_DIR = Path("/root/.gemini/antigravity-ide/brain/8147c069-498f-461b-ad7e-a3e8ac788aec/scratch/iqsk_pages")
TXT_DIR = Path("/root/.gemini/antigravity-ide/brain/8147c069-498f-461b-ad7e-a3e8ac788aec/scratch/iqsk_txt")

PAGE_TRADE_MAPPING = [
    (26, 26, "DEMOLITIONS", "Demolitions and Alterations"),
    (27, 28, "EARTHWORKS", "Earthworks and Excavations"),
    (29, 30, "CONCRETE", "Concrete (In-Situ)"),
    (31, 31, "FORMWORK", "Formwork"),
    (32, 33, "REINFORCEMENT", "Reinforcement"),
    (33, 37, "WALLING", "Walling"),
    (38, 39, "WATERPROOFING", "Waterproofing"),
    (40, 47, "ROOFING", "Roof Coverings & Insulation"),
    (48, 51, "RAINWATER", "Rain Water Goods"),
    (52, 54, "CARPENTRY_JOINERY", "Carpentry and Joinery"),
    (55, 61, "IRONMONGERY", "Ironmongery"),
    (62, 64, "CARPENTRY_JOINERY", "Timber Boards & Partitions"),
    (65, 67, "GLAZING", "Glass and Glazing"),
    (68, 73, "METALWORK", "Aluminium & Metalwork Doors/Windows"),
    (74, 79, "STRUCTURAL_STEEL", "Structural Steel Works"),
    (80, 91, "FINISHES", "Wall, Ceiling and Floor Finishes"),
    (92, 95, "PAINTING", "Painting and Decoration"),
    (96, 109, "ELECTRICAL", "Electrical Installations"),
    (110, 137, "PLUMBING_DRAINAGE", "Plumbing, Drainage & Sanitary Fittings"),
    (138, 144, "FIRE_FIGHTING", "Fire Fighting Equipment"),
    (145, 153, "EXTERNAL_WORKS", "External Works & Drainage"),
    (154, 157, "PLANT_EQUIPMENT", "Plant and Equipment Hire Rates"),
    (158, 164, "APPROXIMATE_ESTIMATING", "Approximate Estimating (Cost/m2)"),
]

def get_trade_for_page(page_num: int):
    for start_p, end_p, trade_code, trade_label in PAGE_TRADE_MAPPING:
        if start_p <= page_num <= end_p:
            return trade_code, trade_label
    return "OTHER", "Other Construction Trade"

def ocr_single_page(args):
    page_num, pdf_path = args
    txt_path = TXT_DIR / f"page_{page_num:03d}.txt"

    if txt_path.exists() and txt_path.stat().st_size > 50:
        with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
            return page_num, [l.strip() for l in f if l.strip()]

    # Find rendered PNG or render on demand
    possible_pngs = [
        PAGES_DIR / f"page-{page_num:03d}.png",
        PAGES_DIR / f"page-{page_num}.png",
        PAGES_DIR / f"page_{page_num:03d}.png",
    ]
    actual_png = next((p for p in possible_pngs if p.exists()), None)

    if not actual_png:
        # Render single page at 110 DPI
        temp_base = PAGES_DIR / f"temp_{page_num:03d}"
        subprocess.run([
            "pdftoppm", "-png", "-r", "110",
            "-f", str(page_num), "-l", str(page_num),
            str(pdf_path), str(temp_base)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        found = list(PAGES_DIR.glob(f"temp_{page_num:03d}*.png"))
        if found:
            actual_png = found[0]

    lines = []
    if actual_png and actual_png.exists():
        txt_base = TXT_DIR / f"page_{page_num:03d}"
        cmd = [
            "tesseract", str(actual_png), str(txt_base),
            "--psm", "6", "-l", "eng"
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if txt_path.exists():
            with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = [l.strip() for l in f if l.strip()]

    return page_num, lines

def clean_rate_token(token: str) -> float | None:
    token = token.replace(",", "").strip()
    # Check for period used as thousands separator e.g. 2.200 or 15.500
    if "." in token:
        parts = token.split(".")
        if len(parts) == 2 and len(parts[1]) == 3 and parts[0].isdigit() and int(parts[0]) > 0:
            token = parts[0] + parts[1]
    # Replace common OCR misreads in numbers
    token = token.replace("O", "0").replace("o", "0").replace("l", "1").replace("S", "5")
    try:
        val = float(token)
        return val if val > 0 else None
    except ValueError:
        return None

def normalize_unit(unit_raw: str) -> str:
    u = unit_raw.upper().strip(" .:,|")
    if u in ["M2", "SQM", "S.M", "S.M.", "SM."]:
        return "SM"
    if u in ["M3", "CUM", "C.M", "C.M.", "CM.", "CU", "OM"]:
        return "CM"
    if u in ["M", "MTR", "L.M", "L.M.", "LM.", "ML"]:
        return "LM"
    if u in ["KGS", "K.G", "K.G.", "KG."]:
        return "KG"
    if u in ["TONS", "TONNE", "TONNES", "T"]:
        return "TON"
    if u in ["NOS", "NR", "N0", "NO."]:
        return "NO"
    if u in ["HRS", "HR", "HOUR"]:
        return "HR"
    if u in ["DAYS", "DY"]:
        return "DAY"
    if u in ["PRS", "PR"]:
        return "PAIR"
    return u

def parse_page_lines(page_num: int, lines: list[str]) -> list[dict]:
    trade_code, trade_label = get_trade_for_page(page_num)
    items = []
    current_subcategory = trade_label
    
    rate_row_regex = re.compile(
        r'^(?P<desc>.+?)\s+(?P<unit>SM|CM|LM|KG|TON|NO|PAIR|SET|ITEM|HA|CU|OM|M2|M3|M|KGS?|MTR|HRS?|DAY|NOS?)\b\.?\s+(?P<rates>[\d\s,.\-—=:~oOlS]+)$',
        re.I
    )

    for line in lines:
        line_clean = line.strip(" |-\t\r\n")
        if not line_clean or len(line_clean) < 4:
            continue

        # Skip headers / footers
        line_upper = line_clean.upper()
        if any(h in line_upper for h in [
            "BUILDING CONSTRUCTION COSTS", "REPUBLIC OF KENYA", "STATE DEPARTMENT",
            "FOR PUBLIC WORKS", "TABLE OF CONTENTS", "KENYA NATIONAL BUREAU", "KNBS",
            "IQSK", "DISCLAIMER", "PREFACE"
        ]):
            continue
        if re.search(r'^(NAIROBI|COASTAL|WESTERN|REGION|\(KSHS\)|DESCRIPTION|UNIT\b)', line_clean, re.I):
            continue

        m = rate_row_regex.search(line_clean)
        if m:
            desc = m.group("desc").strip(" |-\t")
            desc = re.sub(r'^[|:\-—\s]+', '', desc)
            unit = normalize_unit(m.group("unit"))
            rates_str = m.group("rates")

            tokens = re.findall(r'[\d,.\-oOlS]+', rates_str)
            nums = []
            for t in tokens:
                if t in ["-", "—", "--", "---", "."]:
                    continue
                v = clean_rate_token(t)
                if v is not None and 0.5 <= v <= 50_000_000:
                    nums.append(v)

            if nums and len(desc) >= 3:
                rate_nairobi = nums[0]
                rate_coastal = nums[1] if len(nums) > 1 else None
                rate_western = nums[2] if len(nums) > 2 else None
                rate_kes = rate_nairobi

                items.append({
                    "trade": trade_code,
                    "trade_label": trade_label,
                    "subcategory": current_subcategory,
                    "description": desc,
                    "unit": unit,
                    "rate_nairobi": rate_nairobi,
                    "rate_coastal": rate_coastal,
                    "rate_western": rate_western,
                    "rate_kes": rate_kes,
                    "source_page": page_num,
                    "handbook_edition": "2023-2024"
                })
        else:
            if not re.search(r'\d{2,}', line_clean) and len(line_clean) > 3 and len(line_clean) < 80:
                current_subcategory = line_clean

    return items

def extract_handbook(pdf_path: Path, start_page: int = 26, end_page: int = 164, workers: int = 4):
    TXT_DIR.mkdir(parents=True, exist_ok=True)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"=== Starting IQSK Handbook Extraction (Pages {start_page} to {end_page}) ===")
    print(f"Source PDF: {pdf_path}")
    print(f"Worker Processes: {workers}")

    tasks = [(p, pdf_path) for p in range(start_page, end_page + 1)]
    page_results = {}

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(ocr_single_page, t): t[0] for t in tasks}
        completed = 0
        total = len(tasks)
        for fut in as_completed(futures):
            p_num = futures[fut]
            try:
                page_num, lines = fut.result()
                page_results[page_num] = lines
            except Exception as e:
                print(f"Error on page {p_num}: {e}")
                page_results[p_num] = []
            completed += 1
            if completed % 10 == 0 or completed == total:
                print(f"Extraction Progress: {completed}/{total} pages processed ({completed*100//total}%)")

    all_items = []
    trade_counters = {}

    for page_num in sorted(page_results.keys()):
        lines = page_results[page_num]
        items = parse_page_lines(page_num, lines)
        for it in items:
            t = it["trade"]
            trade_counters[t] = trade_counters.get(t, 0) + 1
            it["item_code"] = f"{t[:4]}-{trade_counters[t]:04d}"
            all_items.append(it)

    print(f"\n=== Extraction Completed ===")
    print(f"Total Line Items Extracted: {len(all_items)}")

    # Print summary by trade
    trade_counts = {}
    for it in all_items:
        trade_counts[it["trade"]] = trade_counts.get(it["trade"], 0) + 1
    for tr, cnt in sorted(trade_counts.items()):
        print(f"  - {tr:22s}: {cnt:4d} items")

    # Save to JSON
    json_path = DATA_DIR / "iqsk_rates_2023_2024.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_items, f, indent=2, ensure_ascii=False)
    print(f"\nSaved structured JSON dataset to: {json_path} ({json_path.stat().st_size:,} bytes)")

    # Save to CSV
    csv_path = DATA_DIR / "iqsk_rates_2023_2024.csv"
    if all_items:
        fieldnames = [
            "item_code", "trade", "trade_label", "subcategory", "description",
            "unit", "rate_nairobi", "rate_coastal", "rate_western", "rate_kes",
            "source_page", "handbook_edition"
        ]
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for it in all_items:
                writer.writerow(it)
        print(f"Saved structured CSV dataset to:  {csv_path} ({csv_path.stat().st_size:,} bytes)")

    # Ingest into Django Database
    if HAS_DJANGO and all_items:
        print("\n=== Ingesting into Database (IQSKCostRate) ===")
        IQSKCostRate.objects.filter(handbook_edition="2023-2024").delete()
        
        db_records = []
        for it in all_items:
            db_records.append(
                IQSKCostRate(
                    trade=it["trade"],
                    subcategory=it["subcategory"][:250],
                    item_code=it["item_code"],
                    description=it["description"],
                    unit=it["unit"],
                    rate_nairobi=it["rate_nairobi"],
                    rate_coastal=it["rate_coastal"],
                    rate_western=it["rate_western"],
                    rate_kes=it["rate_kes"],
                    handbook_edition=it["handbook_edition"],
                    source_page=it["source_page"]
                )
            )
        
        IQSKCostRate.objects.bulk_create(db_records, batch_size=500)
        total_in_db = IQSKCostRate.objects.filter(handbook_edition="2023-2024").count()
        print(f"Successfully loaded {total_in_db} IQSK Cost Rates into Django database!")

    return all_items

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract IQSK Cost Handbook rates.")
    parser.add_argument("--pdf", default=PDF_DEFAULT_PATH, help="Path to scanned IQSK Handbook PDF")
    parser.add_argument("--start", type=int, default=26, help="Start page (default: 26)")
    parser.add_argument("--end", type=int, default=164, help="End page (default: 164)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel OCR worker processes")
    args = parser.parse_args()

    extract_handbook(
        pdf_path=Path(args.pdf),
        start_page=args.start,
        end_page=args.end,
        workers=args.workers
    )
