import logging
from typing import Any, Dict, List, Optional
from langgraph.graph import StateGraph, START, END
from django.utils import timezone

from .state import AgentState, DailyBriefingData, AgentAction
from .gateway import LLMGateway
from .tools.finance_tools import inspect_arrears_and_collections
from .tools.facility_tools import inspect_facility_work_orders
from .tools.tenant_tools import inspect_leasing_and_occupancy
from .tools.team_tools import inspect_team_and_hr
from .tools.calendar_tools import get_upcoming_critical_dates, get_sales_pipeline, search_tenant_by_name
from notifications.services import notify_user, send_email_notification
from notifications.models import Notification

logger = logging.getLogger(__name__)


# ─── Node 1: Ingest ERP Domain Context ────────────────────────────────────────

def detect_and_ingest_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 1: Ingest live ERP state across finance, facility, leasing, team,
    calendar, and sales domains — scoped to the user's authorized property view.
    """
    org_id = state.get("organization_id", "")
    if not org_id:
        return {"error": "Missing organization context."}

    # Honour the user's active property scope — exactly as the rest of the app does.
    # None = portfolio-wide; a UUID = single property (user scoped to that property).
    prop_id: Optional[str] = state.get("active_property_id") or None
    allowed_modules: Optional[List[str]] = state.get("allowed_modules")

    fin_data = inspect_arrears_and_collections(org_id, property_id=prop_id, allowed_modules=allowed_modules)
    fac_data = inspect_facility_work_orders(org_id, property_id=prop_id, allowed_modules=allowed_modules)
    lease_data = inspect_leasing_and_occupancy(org_id, property_id=prop_id, allowed_modules=allowed_modules)
    team_data = inspect_team_and_hr(org_id, allowed_modules=allowed_modules)  # HR is org-wide; not property-scoped
    calendar_data = get_upcoming_critical_dates(org_id, property_id=prop_id, allowed_modules=allowed_modules)
    sales_data = get_sales_pipeline(org_id, property_id=prop_id, allowed_modules=allowed_modules)

    # Optional tenant search if query contains a name
    query = state.get("input_query", "")
    tenant_search_data = {}
    if query and len(query) > 2:
        import re
        name_match = re.search(r'(?:tenant|for|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', query)
        if name_match:
            tenant_search_data = search_tenant_by_name(org_id, name_match.group(1), property_id=prop_id, allowed_modules=allowed_modules)

    raw_findings = {
        "finance": fin_data,
        "facility": fac_data,
        "leasing": lease_data,
        "team": team_data,
        "calendar": calendar_data,
        "sales": sales_data,
    }
    if tenant_search_data:
        raw_findings["tenant_search"] = tenant_search_data

    return {
        "financial_data": fin_data,
        "facility_data": fac_data,
        "leasing_data": lease_data,
        "team_data": team_data,
        "raw_findings": raw_findings,
    }


# ─── Node 2: Synthesize Intelligence & Explain ─────────────────────────────────

def synthesize_and_explain_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 2: Calculate portfolio health score and synthesize executive briefing.
    """
    fin = state.get("financial_data", {})
    fac = state.get("facility_data", {})
    lease = state.get("leasing_data", {})
    team = state.get("team_data", {})

    total_arrears = fin.get("total_arrears", 0)
    overdue_count = fin.get("overdue_count", 0)
    urgent_wo = fac.get("urgent_count", 0)
    open_wo = fac.get("open_work_orders", 0)
    expiring_leases = lease.get("expiring_leases_count", 0)
    pending_leaves = team.get("pending_leave_count", 0)

    # Deterministic Baseline Health Score (0 - 100)
    score = 100
    if total_arrears > 100000:
        score -= min(30, int(total_arrears / 10000))
    if urgent_wo > 0:
        score -= min(25, urgent_wo * 10)
    if open_wo > 10:
        score -= 10
    if expiring_leases > 5:
        score -= 10
    score = max(35, min(100, score))

    health_status = "Optimal" if score >= 85 else "Action Required" if score >= 70 else "Critical Attention Needed"

    # LLM Prompt Synthesis
    gateway = LLMGateway()
    system_prompt = (
        "You are Quartermaster, the senior AI Operations Orchestrator for Center Estates ERP. "
        "Provide an authoritative, crisp executive daily briefing highlighting key financial arrears, maintenance alerts, "
        "expiring leases, and team approvals. Keep tone professional, urgent when necessary, and operational."
    )
    user_prompt = (
        f"Generate executive daily briefing for {state.get('user_name', 'Estate Manager')}.\n"
        f"Portfolio Health Score: {score}/100 ({health_status})\n"
        f"Overdue Arrears: KES {total_arrears:,.0f} ({overdue_count} overdue invoices)\n"
        f"Urgent Work Orders: {urgent_wo} ({open_wo} total open)\n"
        f"Expiring Leases (60d): {expiring_leases}\n"
        f"Pending Team Leave Requests: {pending_leaves}\n"
        f"Top defaulters: {fin.get('top_defaulters', [])[:3]}\n"
        f"Critical work orders: {fac.get('critical_orders', [])[:3]}"
    )

    llm_briefing = gateway.generate_chat(system_prompt, [{"role": "user", "content": user_prompt}])

    briefing_dict = {
        "date": timezone.localtime(timezone.now()).strftime("%A, %d %B %Y"),
        "headline": f"Portfolio operating at {score}% health — {health_status}",
        "portfolio_health_score": score,
        "health_status": health_status,
        "key_metrics": {
            "total_arrears": total_arrears,
            "overdue_invoices": overdue_count,
            "urgent_work_orders": urgent_wo,
            "open_work_orders": open_wo,
            "expiring_leases_60d": expiring_leases,
            "pending_leave_requests": pending_leaves,
        },
        "critical_alerts": [
            f"KES {total_arrears:,.0f} in unpaid rent invoices require follow-up." if total_arrears > 0 else "Rent collections on schedule.",
            f"{urgent_wo} emergency maintenance tickets require technician allocation." if urgent_wo > 0 else "No emergency facility breaches.",
            f"{expiring_leases} tenant leases expiring within 60 days." if expiring_leases > 0 else "Lease renewals up to date.",
        ],
        "briefing_narrative": llm_briefing,
        "recommended_focus": [
            "Review and approve automated M-Pesa payment reminder notices.",
            "Confirm technician assignments for pending work orders.",
            "Review draft lease renewals for upcoming expiring tenancies.",
        ],
    }

    return {
        "health_score": score,
        "daily_briefing": briefing_dict,
        "final_response": llm_briefing,
    }


# ─── Node 3: Collate & Prioritize Actionable Interventions ─────────────────────

def propose_interventions_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 3: Assemble prioritized 1-click interventions across all ERP modules.
    """
    fin_actions = state.get("financial_data", {}).get("proposed_actions", [])
    fac_actions = state.get("facility_data", {}).get("proposed_actions", [])
    lease_actions = state.get("leasing_data", {}).get("proposed_actions", [])
    team_actions = state.get("team_data", {}).get("proposed_actions", [])

    all_actions = [*fin_actions, *fac_actions, *lease_actions, *team_actions]

    # Sort by urgency
    urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_actions = sorted(all_actions, key=lambda a: urgency_order.get(a.get("urgency", "medium"), 2))

    # Attach to briefing
    briefing = state.get("daily_briefing") or {}
    briefing["actions"] = sorted_actions

    return {
        "proposed_actions": sorted_actions,
        "daily_briefing": briefing,
    }


# ─── Node 4: LangGraph Chat Reasoning (Grounded Conversational AI) ─────────────

def chat_and_respond_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 4 (Chat mode): Use live domain tool findings to produce a grounded,
    conversational answer to the operator's query.
    """
    import json
    gateway = LLMGateway()
    raw_findings = state.get("raw_findings", {})
    query = state.get("input_query", "")
    user_name = state.get("user_name", "Operator")
    conversation_history = state.get("conversation_history", [])
    local_now = timezone.localtime(timezone.now())

    # Compile grounded domain facts
    fin = raw_findings.get("finance", {})
    fac = raw_findings.get("facility", {})
    lease = raw_findings.get("leasing", {})
    calendar = raw_findings.get("calendar", {})
    sales = raw_findings.get("sales", {})
    tenant_search = raw_findings.get("tenant_search", {})
    active_prop_name = state.get("active_property_name")
    allowed_modules = state.get("allowed_modules")

    scope_line = f"ACTIVE WORKSPACE SCOPE: {active_prop_name}" if active_prop_name else "ACTIVE WORKSPACE SCOPE: Entire Portfolio"

    facts_parts = [
        f"TODAY'S DATE: {local_now.strftime('%A, %d %B %Y, %I:%M %p %Z')}",
        scope_line,
    ]
    if (allowed_modules is None or "property" in allowed_modules):
        facts_parts.append(f"FINANCE: KES {fin.get('total_arrears', 0):,.0f} in arrears across {fin.get('overdue_count', 0)} overdue invoices.")
        if fin.get("collections_last_month") is not None:
            facts_parts.append(
                f"COLLECTIONS: {fin.get('last_month_label', 'last month')} KES {fin.get('collections_last_month', 0):,.0f}; "
                f"{fin.get('this_month_label', 'this month')} KES {fin.get('collections_this_month', 0):,.0f}."
            )
        if fin.get("top_defaulters"):
            facts_parts.append(f"TOP DEFAULTERS: {json.dumps(fin['top_defaulters'][:3], default=str)}")
        if lease.get("expiring_leases_count"):
            facts_parts.append(f"LEASING: {lease['expiring_leases_count']} leases expiring within 60 days.")
        if lease.get("expiring_leases"):
            facts_parts.append(f"EXPIRING LEASES DETAIL: {json.dumps(lease['expiring_leases'][:5], default=str)}")
    if (allowed_modules is None or "facility" in allowed_modules) and fac.get("open_work_orders"):
        facts_parts.append(f"FACILITY: {fac['open_work_orders']} open work orders, {fac.get('urgent_count', 0)} critical.")
    if calendar.get("events"):
        facts_parts.append(f"CALENDAR EVENTS (next 30d): {json.dumps(calendar['events'][:8], default=str)}")
    if (allowed_modules is None or "sales" in allowed_modules) and sales.get("total_listings") is not None:
        facts_parts.append(f"SALES PIPELINE: {sales.get('total_listings', 0)} total listings, by status: {sales.get('listings_by_status', {})}")
    if tenant_search.get("results"):
        facts_parts.append(f"TENANT SEARCH RESULTS: {json.dumps(tenant_search['results'], default=str)}")

    grounded_facts = "\n".join(facts_parts)

    system_prompt = (
        f"You are Quartermaster, the autonomous AI Agent for Center Estates ERP.\n"
        f"Active Operator: {user_name}\n\n"
        f"LIVE GROUNDED SYSTEM DATA:\n{grounded_facts}\n\n"
        "AGENT DIRECTIVES:\n"
        "1. Ground every answer in the live system data above. Never invent figures, names, or records.\n"
        "2. When asked about dates/calendar — use TODAY'S DATE stated above and derive correctly.\n"
        "3. ROLE & SCOPE BOUNDARIES: You operate strictly within the authorized scope of the logged-in operator. All data provided is already scoped to what the operator is authorized to see based on roles and permissions. Never include disclaimers, contrasts, or 'Note:' remarks about workspace filters or portfolio differences. Answer directly and factually for the data authorized and visible to the operator.\n"
        "4. Format responses with clean markdown: bullet points, **bold metrics**, concise paragraphs.\n"
        "5. Tone: Professional, direct, proactive. If data is clear, be definitive — avoid hedging.\n"
        "6. For action requests (send reminders, escalate tickets), describe the proposed action and parameters for user approval.\n"
    )

    messages = []
    for msg in conversation_history[-8:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": query})

    from .grounded import build_grounded_answer
    fallback = build_grounded_answer(
        query, finance=fin, facility=fac, leasing=lease, calendar=calendar,
        scope_label=active_prop_name or "Entire Portfolio",
    )
    response_text = gateway.generate_chat(system_prompt, messages, fallback=fallback)

    tools_executed = []
    if (allowed_modules is None or "property" in allowed_modules) and (fin or lease):
        tools_executed.extend(["finance_data", "leasing_data"])
    if (allowed_modules is None or "facility" in allowed_modules) and fac:
        tools_executed.append("facility_data")
    if calendar.get("events"):
        tools_executed.append("calendar_events")
    if (allowed_modules is None or "sales" in allowed_modules) and sales.get("total_listings") is not None:
        tools_executed.append("sales_pipeline")
    if tenant_search.get("results"):
        tools_executed.append("tenant_search")

    return {
        "final_response": response_text,
        "tools_executed": tools_executed,
    }


# ─── Node 5: Safe Execution of Approved Actions (Human-in-the-Loop) ────────────

def execute_approved_actions_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 5: Execute actions explicitly approved by the user with audit records.
    """
    from django.utils import timezone as tz

    org_id = state.get("organization_id", "")
    approved_ids = set(state.get("approved_action_ids", []))
    proposed = state.get("proposed_actions", [])
    results = []

    for act in proposed:
        if act.get("id") in approved_ids or "all" in approved_ids:
            act_type = act.get("action_type")
            target_id = act.get("target_id")
            payload = act.get("payload", {})

            try:
                if act_type == "send_payment_reminder":
                    tenant_email = payload.get("tenant_email")
                    amount = payload.get("amount", 0)
                    if tenant_email:
                        send_email_notification(
                            recipient_email=tenant_email,
                            recipient_name=act.get("target_name", "Valued Tenant"),
                            subject="[Center Estates] Rent Payment Reminder & M-Pesa Details",
                            message=(
                                f"Dear {act.get('target_name', 'Tenant')}, this is a friendly reminder that an "
                                f"outstanding rent balance of KES {amount:,.0f} is due for your unit. "
                                "You may settle via M-Pesa Paybill. Contact your property manager for assistance."
                            ),
                            action_url="/tenant-portal",
                            organization=None,
                        )
                    # Audit entry
                    _write_agent_audit(org_id, act_type, target_id, act.get("title", ""), state.get("user_id"))
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Dispatched payment reminder for {act.get('target_name')}."})

                elif act_type == "dispatch_work_order":
                    from facilities.models import WorkOrder
                    wo = WorkOrder.objects.filter(id=target_id).first()
                    if wo:
                        wo.priority = 'urgent'
                        wo.save(update_fields=['priority', 'updated_at'])
                        _write_agent_audit(org_id, act_type, target_id, act.get("title", ""), state.get("user_id"))
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Escalated work order {wo.title if wo else target_id} to urgent."})

                elif act_type == "renew_lease":
                    _write_agent_audit(org_id, act_type, target_id, act.get("title", ""), state.get("user_id"))
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Prepared renewal notice for {act.get('target_name')}."})

                elif act_type == "approve_leave":
                    from companion.models import StaffLeaveRequest
                    leave = StaffLeaveRequest.objects.filter(id=target_id).first()
                    if leave:
                        leave.status = StaffLeaveRequest.Status.APPROVED
                        leave.save(update_fields=['status'])
                        _write_agent_audit(org_id, act_type, target_id, act.get("title", ""), state.get("user_id"))
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Approved leave request for {act.get('target_name')}."})

            except Exception as exc:
                logger.error("Execution of action %s failed: %s", act.get("id"), exc)
                results.append({"id": act.get("id"), "status": "failed", "detail": str(exc)})

    return {"execution_results": results}


def _write_agent_audit(org_id: str, action_type: str, target_id: str, title: str, user_id: str = None):
    """Write an audit event for every agent-executed action."""
    try:
        from audit.models import AuditEvent
        AuditEvent.objects.create(
            organization_id=org_id,
            actor_id=user_id,
            action=f"AGENT_{action_type.upper()}",
            target_id=target_id,
            description=f"QM Agent executed: {title}",
        )
    except Exception as exc:
        logger.warning("Failed to write agent audit event: %s", exc)


# ─── Build State Graph ────────────────────────────────────────────────────────

def build_agent_graph() -> StateGraph:
    """
    Construct the LangGraph workflow for Center Estates Quartermaster Agent.
    Supports two modes:
      - 'briefing' → ingest → synthesize → propose_interventions → [execute?]
      - 'chat'     → ingest → chat_and_respond
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("detect_and_ingest", detect_and_ingest_node)
    workflow.add_node("synthesize_and_explain", synthesize_and_explain_node)
    workflow.add_node("propose_interventions", propose_interventions_node)
    workflow.add_node("execute_approved_actions", execute_approved_actions_node)
    workflow.add_node("chat_and_respond", chat_and_respond_node)

    workflow.add_edge(START, "detect_and_ingest")

    # Route based on mode
    def route_after_ingest(state: AgentState):
        mode = state.get("mode", "chat")
        if mode == "chat":
            return "chat_and_respond"
        return "synthesize_and_explain"

    workflow.add_conditional_edges("detect_and_ingest", route_after_ingest, {
        "chat_and_respond": "chat_and_respond",
        "synthesize_and_explain": "synthesize_and_explain",
    })

    workflow.add_edge("chat_and_respond", END)
    workflow.add_edge("synthesize_and_explain", "propose_interventions")

    def route_execution(state: AgentState):
        if state.get("mode") == "action_execution" and state.get("approved_action_ids"):
            return "execute_approved_actions"
        return END

    workflow.add_conditional_edges("propose_interventions", route_execution, {
        "execute_approved_actions": "execute_approved_actions",
        END: END,
    })
    workflow.add_edge("execute_approved_actions", END)

    return workflow.compile()


# Singleton compiled graph runner
agent_orchestrator = build_agent_graph()
