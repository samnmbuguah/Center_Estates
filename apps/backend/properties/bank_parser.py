"""
Multi-Format Bank Statement Parser & Intelligence Engine for Center Estates.

Parses commercial bank statements across:
- National Bank of Kenya (NBK) - Online Banking Export
- National Bank of Kenya (NBK) - CRM Piped Narration Export
- Stanbic Bank Statement Format
- Standard Generic Multi-Column Bank CSV/Excel Statements

Extracts:
- Credit (Money In) vs Debit (Money Out)
- Embedded M-Pesa Receipt Numbers (10-char alphanumeric like TCF6R8PBD2, TDN3VQT0RF, TJG6Z7HDSP)
- Embedded Tenant Account / Unit Numbers
- Embedded Payer Names & Phone Numbers
- Transaction Category (M-Pesa sweep, Cheque, Direct Deposit, Bank Fee, Tax)
"""

import io
import re
import csv
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
import openpyxl

MPESA_REF_REGEX = re.compile(r'\b([A-Z0-9]{10})\b')
PHONE_REGEX = re.compile(r'\b(254\d{9}|07\d{8}|01\d{8}|0\*{5}\d{4}|254\*{5}\d{4})\b')
BANK_FEE_KEYWORDS = {'ledger fee', 'ledgerfee', 'service fee', 'maintenance fee', 'cheque book', 'chq book', 'stamp duty', 'statement fee', 'transfer fee'}
TAX_KEYWORDS = {'excise duty', 'tax amount', 'withholding tax', 'vat debit', 'duty tax'}

def _parse_date(val: Any) -> Optional[date]:
    if isinstance(val, (datetime, date)):
        return val.date() if isinstance(val, datetime) else val
    if not val:
        return None
    s = str(val).strip()
    # Try ISO or string date formats common in Kenyan bank statements
    formats = (
        '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y',
        '%d %b %Y', '%d %B %Y', '%d %b %y', '%d %B %y', '%d %b %Y %H:%M:%S',
        '%Y/%m/%d', '%m/%d/%Y', '%b %d, %Y', '%d.%m.%Y'
    )
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    # Try extracting date pattern like 15 MAR 25 or 23/04/2025 or 2025-07-12 from start of string
    match = re.search(r'\b(\d{1,4}[\/\-\s][A-Za-z0-9]{2,9}[\/\-\s]\d{2,4})\b', s)
    if match:
        extracted = match.group(1)
        for fmt in formats:
            try:
                return datetime.strptime(extracted, fmt).date()
            except ValueError:
                pass
    return None

def _parse_decimal(val: Any) -> Decimal:
    if val is None:
        return Decimal('0')
    if isinstance(val, (int, float, Decimal)):
        return Decimal(str(val))
    s = str(val).strip().replace(',', '').replace('KES', '').replace('KES.', '').replace('$', '').strip()
    if not s or s == '-' or s.lower() == 'null' or s.lower() == 'none':
        return Decimal('0')
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal('0')

def parse_transaction_details(details: str) -> Dict[str, Any]:
    """
    Intelligently extracts M-Pesa receipt, account/unit, payer name, phone number,
    and transaction category from a bank narration string.
    """
    cleaned = str(details or '').strip()
    res = {
        'mpesa_ref': '',
        'account': '',
        'payer_name': '',
        'phone': '',
        'category': 'other',
    }
    if not cleaned:
        return res

    lower = cleaned.lower()

    # 1. Check for Bank Fees & Taxes
    if any(k in lower for k in TAX_KEYWORDS):
        res['category'] = 'tax'
        return res
    if any(k in lower for k in BANK_FEE_KEYWORDS):
        res['category'] = 'bank_fee'
        return res

    # 2. Check for Cheques
    if 'cheque' in lower or 'chq' in lower or 'transfer chq' in lower:
        res['category'] = 'cheque'

    # 3. Piped NBK CRM Format: e.g. "TDN3VQT0RF|From Acc.No. - KES1452600010077|TDN3VQT0RF|4147713606888|106|NAIMA|MPESA MERCHANT TILL ACC"
    if '|' in cleaned:
        parts = [p.strip() for p in cleaned.split('|') if p.strip()]
        for part in parts:
            if MPESA_REF_REGEX.fullmatch(part) and not res['mpesa_ref']:
                res['mpesa_ref'] = part
                res['category'] = 'mpesa_sweep'
            elif PHONE_REGEX.fullmatch(part) and not res['phone']:
                res['phone'] = part
            elif part.isdigit() and len(part) <= 5 and not res['account']:
                res['account'] = part
            elif len(part) > 2 and not part.startswith('From Acc') and not 'MPESA' in part and not part.isdigit() and not res['payer_name']:
                res['payer_name'] = part

        if res['mpesa_ref']:
            res['category'] = 'mpesa_sweep'
            return res

    # 4. Standard NBK / M-PESA Space Format:
    # e.g. "TCF6R8PBD2 From Acc.No. - KES1484877030077 TCF6R8PBD2 625625 7717951274 254714916329 KINGSLEY NWABUZOR AHI MPESA PAY BILL"
    if 'mpesa' in lower or 'pay bill' in lower or 'paybill' in lower or 'till' in lower:
        res['category'] = 'mpesa_sweep'

    # Extract M-Pesa receipt code
    mpesa_matches = MPESA_REF_REGEX.findall(cleaned)
    for m in mpesa_matches:
        if m.upper() not in {'TRANSACTIO', 'LEDGERFEES', 'COMMISSION', 'SETTLEMENT', 'STATEMENT'}:
            res['mpesa_ref'] = m
            break

    # Extract Phone
    phone_match = PHONE_REGEX.search(cleaned)
    if phone_match:
        res['phone'] = phone_match.group(1)

    # Extract Payer Name
    if 'mpesa pay bill' in lower:
        before_paybill = re.split(r'mpesa\s+pay\s*bill', cleaned, flags=re.IGNORECASE)[0]
        tokens = before_paybill.strip().split()
        name_tokens = [
            t for t in tokens
            if not t.isdigit() and not PHONE_REGEX.fullmatch(t) and not t.startswith('KES')
            and t != 'From' and t != 'Acc.No.' and t != '-' and not MPESA_REF_REGEX.fullmatch(t)
            and t.upper() != res['mpesa_ref'].upper() and t.upper() != res['account'].upper()
        ]
        if name_tokens:
            res['payer_name'] = ' '.join(name_tokens[-3:])
    elif 'mpesa' in lower:
        tokens = cleaned.split()
        name_tokens = [
            t for t in tokens
            if t.isalpha() and not MPESA_REF_REGEX.fullmatch(t)
            and t.upper() not in {'FROM', 'ACC', 'NO', 'KES', 'MPESA', 'MERCHANT', 'TILL', 'PAY', 'BILL', 'SETTLEMENT'}
            and t.upper() != res['mpesa_ref'].upper() and t.upper() != res['account'].upper()
        ]
        if name_tokens:
            res['payer_name'] = ' '.join(name_tokens[:3])

    # Extract Unit/Account Reference if present
    account_match = re.search(r'\b(?:unit|acc|apt|room|house)?\s*([0-9]{1,4}[A-Za-z]?)\b', cleaned, re.IGNORECASE)
    if account_match:
        cand = account_match.group(1)
        if len(cand) <= 4 and cand not in {'2024', '2025', '2026', '0', '00'}:
            res['account'] = cand

    if not res['category'] or res['category'] == 'other':
        if 'transfer' in lower or 'eft' in lower or 'rtgs' in lower or 'deposit' in lower:
            res['category'] = 'direct_deposit'

    return res

def parse_bank_statement_file(file_content: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Primary parser entrypoint. Accepts raw bytes of .xlsx, .xls, or .csv and
    returns a normalized list of parsed transaction records.
    """
    fn = filename.lower()
    if fn.endswith('.xlsx') or fn.endswith('.xlsm'):
        return _parse_excel(file_content)
    elif fn.endswith('.csv') or fn.endswith('.txt'):
        return _parse_csv(file_content)
    else:
        try:
            return _parse_excel(file_content)
        except Exception:
            return _parse_csv(file_content)

def _parse_csv(content: bytes) -> List[Dict[str, Any]]:
    decoded = ""
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            decoded = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if not decoded:
        raise ValueError("Could not decode CSV statement file.")

    reader = csv.reader(io.StringIO(decoded))
    raw_rows = [r for r in reader if any(cell.strip() for cell in r)]
    return _parse_matrix_rows(raw_rows)

def _parse_excel(content: bytes) -> List[Dict[str, Any]]:
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    all_results = []
    seen_refs = set()

    # If multiple sheets exist, check candidate sheets with data
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        raw_rows = list(ws.iter_rows(values_only=True))
        if len(raw_rows) < 2:
            continue
        parsed = _parse_matrix_rows(raw_rows, seen_refs=seen_refs)
        if parsed:
            all_results.extend(parsed)
            # If the active or main statement sheet produced lots of rows, we are done
            if len(all_results) > 10:
                break

    return all_results

def _parse_matrix_rows(rows: List[Any], seen_refs: Optional[set] = None) -> List[Dict[str, Any]]:
    if not rows:
        return []
    if seen_refs is None:
        seen_refs = set()

    header_idx = -1
    header_col_map = {}

    for idx, row in enumerate(rows[:30]):
        lower_cells = [str(c or '').strip().lower() for c in row]
        col_map = {}
        for c_idx, cell in enumerate(lower_cells):
            if any(k in cell for k in ('txn date', 'transaction date', 'trans date', 'bank date', 'date', 'value date')):
                if 'transacted_on' not in col_map or 'txn' in cell or 'transaction' in cell or 'bank date' in cell:
                    col_map['transacted_on'] = c_idx
            if any(k in cell for k in ('bank transaction ref', 'transaction ref', 'reference', 'ref', 'cheque no', 'chq no')):
                if 'reference' not in col_map or 'ref' in cell:
                    col_map['reference'] = c_idx
            if any(k in cell for k in ('narration', 'transaction details', 'description', 'particulars', 'details', 'party / name', 'payer')):
                if 'description' not in col_map or 'details' in cell or 'narration' in cell:
                    col_map['description'] = c_idx
            if any(k in cell for k in ('bank credit', 'credit', 'money in', 'deposit', 'm-pesa amount', 'bank amount', 'cr')):
                if 'credit' not in col_map or 'credit' in cell or 'money in' in cell:
                    col_map['credit'] = c_idx
            if any(k in cell for k in ('debit', 'money out', 'withdrawal', 'dr')):
                col_map['debit'] = c_idx
            if any(k in cell for k in ('amount', 'net amount')):
                if 'amount' not in col_map:
                    col_map['amount'] = c_idx
            if any(k in cell for k in ('balance', 'book balance', 'ledger balance', 'remaining balance')):
                col_map['balance'] = c_idx

        # Must have at least a date and either (credit/debit/amount)
        if 'transacted_on' in col_map and ('credit' in col_map or 'amount' in col_map or 'debit' in col_map):
            header_idx = idx
            header_col_map = col_map
            break

    if header_idx == -1:
        return []

    parsed = []

    for row_idx, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        if not any(c is not None and str(c).strip() for c in row):
            continue

        # Extract Date
        date_idx = header_col_map.get('transacted_on')
        date_val = row[date_idx] if date_idx is not None and date_idx < len(row) else None
        transacted_on = _parse_date(date_val)
        if not transacted_on:
            continue

        # Extract Description
        desc_idx = header_col_map.get('description')
        description = str(row[desc_idx] if desc_idx is not None and desc_idx < len(row) and row[desc_idx] is not None else "").strip()

        if 'balance b/f' in description.lower() or 'opening balance' in description.lower():
            continue

        # Extract Money In & Out
        credit = Decimal('0')
        debit = Decimal('0')

        if 'credit' in header_col_map and header_col_map['credit'] < len(row):
            credit = _parse_decimal(row[header_col_map['credit']])
        if 'debit' in header_col_map and header_col_map['debit'] < len(row):
            debit = _parse_decimal(row[header_col_map['debit']])

        if credit == 0 and debit == 0 and 'amount' in header_col_map and header_col_map['amount'] < len(row):
            amt = _parse_decimal(row[header_col_map['amount']])
            if amt >= 0:
                credit = amt
            else:
                debit = abs(amt)

        net_amount = credit if credit > 0 else debit
        if net_amount <= 0:
            continue

        # Extract Reference
        ref_idx = header_col_map.get('reference')
        raw_ref = str(row[ref_idx] if ref_idx is not None and ref_idx < len(row) and row[ref_idx] is not None else "").strip()

        # Extract Balance
        bal_idx = header_col_map.get('balance')
        balance = _parse_decimal(row[bal_idx]) if bal_idx is not None and bal_idx < len(row) and row[bal_idx] is not None else None

        # Parse narration intelligence
        intel = parse_transaction_details(description)

        if not raw_ref or raw_ref.lower() in {'null', 'none', '-'}:
            if intel['mpesa_ref']:
                raw_ref = intel['mpesa_ref']
            else:
                raw_ref = f"TXN-{transacted_on:%Y%m%d}-{net_amount}-{abs(hash(description)) % 100000:05d}"

        unique_ref = raw_ref
        counter = 1
        while unique_ref in seen_refs:
            counter += 1
            unique_ref = f"{raw_ref}_{counter}"
        seen_refs.add(unique_ref)

        parsed.append({
            'reference': unique_ref,
            'transacted_on': transacted_on,
            'description': description[:250],
            'amount': net_amount,
            'money_in': credit,
            'money_out': debit,
            'transaction_type': intel['category'],
            'extracted_mpesa_ref': intel['mpesa_ref'],
            'extracted_account': intel['account'],
            'extracted_payer_name': intel['payer_name'],
            'extracted_phone': intel['phone'],
            'raw_details': description,
            'balance_after': balance,
        })

    return parsed
