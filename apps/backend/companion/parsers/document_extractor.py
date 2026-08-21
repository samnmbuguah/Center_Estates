import re
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def extract_lease_data(document_text: str, gateway=None) -> Dict[str, Any]:
    """
    Intelligently extract key lease & tenant parameters from document text
    using LLM structured synthesis with regex fallback.
    """
    if not document_text or not document_text.strip():
        return {"success": False, "error": "Document content is empty."}

    # 1. Try LLM Gateway Extraction if available
    if gateway:
        system_prompt = (
            "You are an expert Real Estate Legal & Lease Auditor. "
            "Extract structured tenant and lease metadata from the provided lease contract agreement. "
            "Return ONLY a JSON object with keys: "
            "tenant_name (string), id_number (string), phone_number (string), email (string), "
            "unit_name (string), property_name (string), rent_amount (number), deposit_amount (number), "
            "start_date (YYYY-MM-DD or string), end_date (YYYY-MM-DD or string), "
            "escalation_percent (number), summary (brief 2-sentence overview)."
        )
        data = gateway.generate_structured_json(system_prompt, document_text[:6000])
        if data and isinstance(data, dict) and (data.get("tenant_name") or data.get("rent_amount")):
            return {"success": True, "extracted": data, "engine": "llm"}

    # 2. Resilient Regex / Deterministic Extraction Fallback
    extracted = {}
    text = document_text

    # Extract Tenant Name
    name_match = re.search(r"(?:tenant|lessee|between\s+[\w\s]+\s+and)\s*[:\-]?\s*([A-Z][A-Za-z\s]{3,35})", text, re.IGNORECASE)
    if name_match:
        extracted["tenant_name"] = name_match.group(1).strip()

    # Extract ID / Passport Number
    id_match = re.search(r"(?:id\s*(?:no|number)|national\s*id|passport)\s*[:\-]?\s*(\d{6,10})", text, re.IGNORECASE)
    if id_match:
        extracted["id_number"] = id_match.group(1).strip()

    # Extract Phone
    phone_match = re.search(r"(?:phone|mobile|tel|contact)\s*[:\-]?\s*(07\d{8}|254\d{9}|\+254\d{9})", text, re.IGNORECASE)
    if phone_match:
        extracted["phone_number"] = phone_match.group(1).strip()

    # Extract Email
    email_match = re.search(r"[\w\.\-]+@[\w\.\-]+\.[a-zA-Z]{2,6}", text)
    if email_match:
        extracted["email"] = email_match.group(0).strip()

    # Extract Rent Amount
    rent_match = re.search(r"(?:rent|monthly\s*fee|payable)\s*(?:of|is)?\s*(?:kes|ksh|kes\.)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if rent_match:
        try:
            val = float(rent_match.group(1).replace(",", ""))
            if val > 1000:
                extracted["rent_amount"] = val
        except Exception:
            pass

    # Extract Deposit Amount
    deposit_match = re.search(r"(?:deposit|security\s*deposit)\s*(?:of|is)?\s*(?:kes|ksh|kes\.)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if deposit_match:
        try:
            val = float(deposit_match.group(1).replace(",", ""))
            if val > 1000:
                extracted["deposit_amount"] = val
        except Exception:
            pass

    # Extract Unit Name
    unit_match = re.search(r"(?:unit|apartment|flat|suite|office|shop)\s*(?:no|number)?\s*[:\-]?\s*([A-Z0-9\-]+)", text, re.IGNORECASE)
    if unit_match:
        extracted["unit_name"] = unit_match.group(1).strip()

    return {
        "success": True,
        "extracted": extracted,
        "engine": "deterministic_parser",
        "summary": "Extracted key tenancy parameters from document text.",
    }
