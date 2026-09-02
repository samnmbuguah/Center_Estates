"""
Dedicated Model-Agnostic AI Agent Orchestrator & ERP Tool Harness for Center Estates.
Supports DeepSeek R1/V3, OpenAI, Anthropic, NVIDIA NIM, and local Ollama endpoints.
Implements the core 'Detect -> Explain -> Recommend -> Human Approve -> Execute -> Monitor' loop.
"""

import json
import os
import urllib.request
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class QMAgentOrchestrator:
    """Enterprise Model Gateway and Tool Orchestrator for Center Estates ERP."""

    def __init__(self, organization_name: str = "Center Estates"):
        self.organization_name = organization_name
        
        # Support generic AI gateway env vars with provider-specific fallbacks
        self.api_key = (
            os.environ.get('AI_ORCHESTRATOR_API_KEY')
            or os.environ.get('OPENCODE_API_KEY')
            or os.environ.get('DEEPSEEK_API_KEY')
            or os.environ.get('OPENAI_API_KEY')
            or os.environ.get('NVIDIA_API_KEY')
        )
        
        base_url = (
            os.environ.get('AI_ORCHESTRATOR_BASE_URL')
            or os.environ.get('OPENCODE_API_URL')
            or os.environ.get('DEEPSEEK_BASE_URL')
            or os.environ.get('NVIDIA_API_URL')
            or 'https://api.deepseek.com/v1'
        ).rstrip('/')
        
        self.api_url = f'{base_url}/chat/completions' if not base_url.endswith(('/chat/completions', '/responses')) else base_url
        self.uses_responses_api = self.api_url.endswith('/responses')
        self.model = (
            os.environ.get('AI_ORCHESTRATOR_MODEL')
            or os.environ.get('OPENCODE_MODEL')
            or os.environ.get('DEEPSEEK_MODEL')
            or os.environ.get('NVIDIA_MODEL')
            or 'deepseek-chat'
        )
        timeout = os.environ.get('AI_TIMEOUT_SECONDS') or os.environ.get('NVIDIA_TIMEOUT_SECONDS') or '30'
        self.timeout_seconds = min(max(int(timeout), 5), 45)

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.api_url and self.model)

    def get_registered_tools(self) -> List[Dict[str, Any]]:
        """Standardized Tool Definitions exposed to the Agent Harness."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_property_occupancy",
                    "description": "Fetch portfolio building occupancy, total units, vacant spaces, and active leases.",
                    "parameters": {
                        "type": "object",
                        "properties": {"property_id": {"type": "string", "description": "Optional specific property ID"}},
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_rent_arrears_summary",
                    "description": "Get rent collection totals, overdue tenant list, and aged rent breakdown by bucket.",
                    "parameters": {
                        "type": "object",
                        "properties": {"days_overdue": {"type": "integer", "description": "Filter by minimum days overdue"}},
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_facility_work_orders",
                    "description": "Get open work orders, urgent asset maintenance alerts, and PPM schedule status.",
                    "parameters": {
                        "type": "object",
                        "properties": {"priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]}},
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "propose_tenant_reminder",
                    "description": "Propose an automated WhatsApp or Email arrears reminder for a delinquent tenant (requires human approval).",
                    "parameters": {
                        "type": "object",
                        "required": ["tenant_id", "channel"],
                        "properties": {
                            "tenant_id": {"type": "string"},
                            "channel": {"type": "string", "enum": ["whatsapp", "email", "sms"]},
                            "custom_message": {"type": "string"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "propose_work_order",
                    "description": "Draft a facility work order from a tenant complaint or asset defect (requires human approval).",
                    "parameters": {
                        "type": "object",
                        "required": ["title", "priority"],
                        "properties": {
                            "title": {"type": "string"},
                            "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                            "category": {"type": "string"},
                            "unit_id": {"type": "string"}
                        }
                    }
                }
            }
        ]

    def generate_daily_briefing(self, user_name: str, erp_context: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesizes a structured daily executive briefing from live ERP telemetry."""
        overdue_invoices = erp_context.get("overdue_invoices", [])
        expiring_leases = erp_context.get("expiring_leases", [])
        open_work_orders = erp_context.get("open_work_orders", [])
        pending_leave = erp_context.get("pending_leave", [])
        billing_candidates = erp_context.get("billing_candidates", 0)
        collection_rate = erp_context.get("collection_rate", 0)

        # Generate intelligent actionable priorities
        priorities = []
        
        if overdue_invoices:
            high_debt = [inv for inv in overdue_invoices if float(inv.get("balance", 0)) > 50000]
            count = len(high_debt) or len(overdue_invoices)
            priorities.append({
                "id": "p-arrears",
                "severity": "high" if count > 0 else "medium",
                "icon": "⚠️",
                "title": f"{count} Tenanc{'ies' if count > 1 else 'y'} in Critical Arrears",
                "description": f"Overdue rent balances require follow-up. Collection rate is currently {collection_rate}%.",
                "actionLabel": "Send WhatsApp Reminders",
                "actionRoute": "/property?tab=arrears",
                "category": "Property & Collections"
            })

        if billing_candidates > 0:
            priorities.append({
                "id": "p-billing",
                "severity": "medium",
                "icon": "🧾",
                "title": f"Monthly Billing Run Ready ({billing_candidates} Units)",
                "description": "Rent and utility charge schedules are ready for validation and invoice dispatch.",
                "actionLabel": "Review Billing Pipeline",
                "actionRoute": "/property?tab=invoicing",
                "category": "Invoicing"
            })

        if expiring_leases:
            priorities.append({
                "id": "p-leases",
                "severity": "medium",
                "icon": "📄",
                "title": f"{len(expiring_leases)} Lease{'s' if len(expiring_leases) > 1 else ''} Expiring in <60 Days",
                "description": "Tenancy agreements reaching term require renewal negotiations or vacancy preparation.",
                "actionLabel": "Review Lease Expiries",
                "actionRoute": "/property?tab=leases",
                "category": "Tenancy"
            })

        if open_work_orders:
            urgent_wo = [wo for wo in open_work_orders if wo.get("priority") in ("urgent", "high")]
            if urgent_wo:
                priorities.append({
                    "id": "p-maintenance",
                    "severity": "high",
                    "icon": "🛠️",
                    "title": f"{len(urgent_wo)} High-Priority Facility Work Orders",
                    "description": "Urgent maintenance tickets approaching SLA response deadlines.",
                    "actionLabel": "Dispatch Contractors",
                    "actionRoute": "/facility?tab=work-orders",
                    "category": "Facilities"
                })

        if pending_leave:
            priorities.append({
                "id": "p-leave",
                "severity": "low",
                "icon": "👥",
                "title": f"{len(pending_leave)} Staff Leave / HR Requests Pending",
                "description": "Team requests awaiting supervisory sign-off.",
                "actionLabel": "Review Requests",
                "actionRoute": "/companion?tab=team",
                "category": "Companion & People"
            })

        # If LLM is configured, refine the natural language greeting
        summary_text = (
            f"Good morning, {user_name}. The portfolio stands at {collection_rate}% collection efficiency. "
            f"You have {len(priorities)} primary operational priorities requiring your attention today."
        )

        return {
            "status": "ready",
            "greeting": summary_text,
            "generatedAt": erp_context.get("timestamp", ""),
            "propertyScope": erp_context.get("property_name", "Portfolio Wide"),
            "healthScore": min(max(int(collection_rate * 0.8 + 20), 10), 98),
            "priorities": priorities,
            "quickStats": {
                "collectionRate": f"{collection_rate}%",
                "activeTenants": erp_context.get("active_tenants", 0),
                "openTickets": len(open_work_orders),
                "pendingApprovals": len(pending_leave) + (1 if billing_candidates > 0 else 0)
            }
        }

    def execute_agent(self, prompt: str, user_name: str, context_str: str) -> dict:
        """Execute an intelligent Agent turn through the configured Model Gateway."""
        if not self.configured:
            return {
                "agent": "Center Estates AI Copilot",
                "status": "local",
                "response": ""
            }

        system_instruction = (
            f"You are the Center Estates AI Agent Orchestrator for {self.organization_name}.\n"
            f"Active Operator: {user_name}\n"
            f"Live System Context:\n{context_str}\n\n"
            "OPERATIONAL RULES:\n"
            "1. Answer the operator's exact question first, then use only authorized live ERP data. Never invent figures, tenants, or records.\n"
            "2. Follow the Loop: Detect -> Explain -> Recommend Action -> Require Approval.\n"
            "3. Format responses cleanly using standard markdown: bullet points (• or -), bold metrics (**KES 50,000**), and concise paragraphs. Never use ASCII underlines (like '====') or excessive header hashes (like '####').\n"
            "4. Tone: Professional, helpful, proactive, and concise. Highlight key actions immediately.\n"
            "5. For financial, tenant notice, or work order proposals, formulate exact parameters for user approval.\n"
            "6. When asked about a validation error, explain it in plain language. If the field is not identified in the error/context, say that clearly and give the shortest safe next step; do not replace the answer with a generic portfolio summary.\n"
        )

        if self.uses_responses_api:
            payload = {
                "model": self.model,
                "input": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
                "max_output_tokens": 450,
            }
        else:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 450
            }

        try:
            req = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}',
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8'))
                    if self.uses_responses_api:
                        agent_text = str(data.get('output_text', '')).strip()
                        if not agent_text:
                            chunks = []
                            for item in data.get('output', []):
                                for content in item.get('content', []):
                                    if content.get('type') in ('output_text', 'text'):
                                        chunks.append(str(content.get('text', '')))
                            agent_text = ''.join(chunks).strip()
                    else:
                        agent_text = data['choices'][0]['message']['content'].strip()
                    if not agent_text:
                        raise ValueError('AI provider returned no message text')
                    return {
                        "agent": "Center Estates AI Copilot",
                        "status": "success",
                        "response": agent_text,
                        "model": self.model,
                        "toolsExposed": [t["function"]["name"] for t in self.get_registered_tools()]
                    }
        except Exception as err:
            logger.warning("AI Orchestrator request failed (%s): %s", self.model, type(err).__name__)

        return {
            "agent": "Center Estates AI Copilot",
            "status": "unavailable",
            "response": ""
        }
