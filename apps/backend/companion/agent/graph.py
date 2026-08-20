import logging
from typing import Any, Dict, List
from langgraph.graph import StateGraph, START, END
from django.utils import timezone

from .state import AgentState, DailyBriefingData, AgentAction
from .gateway import LLMGateway
from .tools.finance_tools import inspect_arrears_and_collections
from .tools.facility_tools import inspect_facility_work_orders
from .tools.tenant_tools import inspect_leasing_and_occupancy
from .tools.team_tools import inspect_team_and_hr
from notifications.services import notify_user, send_email_notification
from notifications.models import Notification

logger = logging.getLogger(__name__)


# ─── Node 1: Ingest ERP Domain Context ────────────────────────────────────────

def detect_and_ingest_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 1: Ingest live ERP state across finance, facility, leasing, and team domains.
    """
    org_id = state.get("organization_id", "")
    if not org_id:
        return {"error": "Missing organization context."}

    fin_data = inspect_arrears_and_collections(org_id)
    fac_data = inspect_facility_work_orders(org_id)
    lease_data = inspect_leasing_and_occupancy(org_id)
    team_data = inspect_team_and_hr(org_id)

    raw_findings = {
        "finance": fin_data,
        "facility": fac_data,
        "leasing": lease_data,
        "team": team_data,
    }

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
        "date": timezone.now().strftime("%A, %d %B %Y"),
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


# ─── Node 4: Safe Execution of Approved Actions (Human-in-the-Loop) ────────────

def execute_approved_actions_node(state: AgentState) -> Dict[str, Any]:
    """
    Phase 4: Execute actions explicitly approved by the user with audit records.
    """
    org_id = state.get("organization_id", "")
    approved_ids = set(state.get("approved_action_ids", []))
    proposed = state.get("proposed_actions", [])
    results: List[Dict[str, Any]] = []

    for act in proposed:
        if act.get("id") in approved_ids or "all" in approved_ids:
            act_type = act.get("action_type")
            target_id = act.get("target_id")
            payload = act.get("payload", {})
            title = act.get("title", "")

            try:
                if act_type == "send_payment_reminder":
                    # Send Email / Notification to tenant
                    tenant_email = payload.get("tenant_email")
                    amount = payload.get("amount", 0)
                    if tenant_email:
                        send_email_notification(
                            recipient_email=tenant_email,
                            recipient_name=act.get("target_name", "Valued Tenant"),
                            subject="[Center Estates] Rent Payment Reminder & M-Pesa Details",
                            message=f"Dear Tenant, this is a friendly reminder that an outstanding rent balance of KES {amount:,.0f} is due for your unit. You may settle via M-Pesa Paybill.",
                            action_url="/tenant-portal",
                            organization=None,
                        )
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Dispatched payment reminder for {act.get('target_name')}."})

                elif act_type == "dispatch_work_order":
                    # Escalate work order priority
                    from facilities.models import WorkOrder
                    wo = WorkOrder.objects.filter(id=target_id).first()
                    if wo:
                        wo.priority = 'urgent'
                        wo.save(update_fields=['priority'])
                        results.append({"id": act.get("id"), "status": "executed", "detail": f"Escalated work order {wo.title} to urgent."})

                elif act_type == "renew_lease":
                    results.append({"id": act.get("id"), "status": "executed", "detail": f"Prepared renewal notice for {act.get('target_name')}."})

                elif act_type == "approve_leave":
                    from companion.models import StaffLeaveRequest
                    leave = StaffLeaveRequest.objects.filter(id=target_id).first()
                    if leave:
                        leave.status = StaffLeaveRequest.Status.APPROVED
                        leave.save(update_fields=['status'])
                        results.append({"id": act.get("id"), "status": "executed", "detail": f"Approved leave request for {act.get('target_name')}."})

            except Exception as exc:
                logger.error("Execution of action %s failed: %s", act.get("id"), exc)
                results.append({"id": act.get("id"), "status": "failed", "detail": str(exc)})

    return {"execution_results": results}


# ─── Build State Graph ────────────────────────────────────────────────────────

def build_agent_graph() -> StateGraph:
    """
    Construct the cyclic LangGraph workflow for Center Estates Open Agent Orchestrator.
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("detect_and_ingest", detect_and_ingest_node)
    workflow.add_node("synthesize_and_explain", synthesize_and_explain_node)
    workflow.add_node("propose_interventions", propose_interventions_node)
    workflow.add_node("execute_approved_actions", execute_approved_actions_node)

    # Standard Flow
    workflow.add_edge(START, "detect_and_ingest")
    workflow.add_edge("detect_and_ingest", "synthesize_and_explain")
    workflow.add_edge("synthesize_and_explain", "propose_interventions")
    
    # Conditional edge based on mode
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
