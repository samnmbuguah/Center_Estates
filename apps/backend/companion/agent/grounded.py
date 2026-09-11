"""Deterministic, data-grounded answers.

Used when the LLM gateway is unavailable or rejects the request (for example an
expired key or a provider that blocks external calls). Rather than returning a
generic greeting, Quartermaster answers from the same live ERP data the model
would have received.
"""

from typing import Any, Dict, Optional


def _wants(query: str, *terms: str) -> bool:
    q = (query or "").lower()
    return any(term in q for term in terms)


def _money(value: Any) -> str:
    try:
        return f"KES {float(value or 0):,.0f}"
    except (TypeError, ValueError):
        return "KES 0"


def build_grounded_answer(
    query: str,
    finance: Optional[Dict[str, Any]] = None,
    facility: Optional[Dict[str, Any]] = None,
    leasing: Optional[Dict[str, Any]] = None,
    calendar: Optional[Dict[str, Any]] = None,
    scope_label: str = "Entire Portfolio",
) -> str:
    """Compose a concise markdown answer from live tool findings."""
    fin = finance or {}
    fac = facility or {}
    lease = leasing or {}
    events = (calendar or {}).get("events") or []

    lines = [f"**Quartermaster · {scope_label}**", ""]
    matched = False

    if _wants(query, "collection", "collected", "collect", "rent", "arrear", "payment",
              "owe", "outstanding", "income", "revenue", "cash", "billed", "invoice",
              "month", "money", "receipt"):
        matched = True
        lines.append("**Collections & Arrears**")
        if fin.get("collections_last_month") is not None:
            lines.append(f"• Collections · {fin.get('last_month_label', 'last month')}: **{_money(fin.get('collections_last_month'))}**")
            lines.append(f"• Collections · {fin.get('this_month_label', 'this month')}: **{_money(fin.get('collections_this_month'))}**")
        lines.append(f"• Outstanding arrears: **{_money(fin.get('total_arrears'))}** across {fin.get('overdue_count', 0)} overdue invoice(s).")
        for d in (fin.get("top_defaulters") or [])[:3]:
            lines.append(f"  - {d.get('tenant_name', 'Tenant')} · Unit {d.get('unit', '—')} · **{_money(d.get('balance_due'))}** due {d.get('due_date', '—')}")
        lines.append("")

    if _wants(query, "maintenance", "work order", "facility", "repair", "ticket", "ppm", "asset", "service request"):
        matched = True
        lines.append("**Facility & Maintenance**")
        lines.append(f"• Open work orders: **{fac.get('open_work_orders', 0)}** ({fac.get('urgent_count', 0)} critical).")
        for o in (fac.get("critical_orders") or [])[:3]:
            lines.append(f"  - {o.get('reference', '')} · {o.get('title', '')} · {o.get('priority', '')}")
        lines.append("")

    if _wants(query, "lease", "tenant", "occupancy", "vacan", "expir"):
        matched = True
        lines.append("**Leasing & Occupancy**")
        lines.append(f"• Leases expiring within 60 days: **{lease.get('expiring_leases_count', 0)}**.")
        for l in (lease.get("expiring_leases") or [])[:3]:
            lines.append(f"  - {l.get('tenant_name', 'Tenant')} · Unit {l.get('unit', '—')} · ends {l.get('ends_on', '—')}")
        lines.append("")

    if _wants(query, "calendar", "schedule", "due", "upcoming", "critical date", "next", "today", "date"):
        matched = True
        if events:
            lines.append("**Upcoming critical dates**")
            for e in events[:6]:
                lines.append(f"• {e.get('date', '')} · {e.get('title', '')}")
            lines.append("")

    if not matched:
        lines.append("**Portfolio snapshot**")
        if fin.get("collections_last_month") is not None:
            lines.append(f"• Collections · {fin.get('last_month_label', 'last month')}: **{_money(fin.get('collections_last_month'))}**")
        lines.append(f"• Outstanding arrears: **{_money(fin.get('total_arrears'))}** ({fin.get('overdue_count', 0)} invoices).")
        lines.append(f"• Open work orders: **{fac.get('open_work_orders', 0)}**.")
        lines.append(f"• Leases expiring (60d): **{lease.get('expiring_leases_count', 0)}**.")
        lines.append("")

    lines.append("_Answer generated from live ERP data. Ask about collections, arrears, maintenance, leases or upcoming dates._")
    return "\n".join(lines)
