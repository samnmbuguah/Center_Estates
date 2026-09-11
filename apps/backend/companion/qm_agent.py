"""
Dedicated Autonomous AI Agent Orchestrator & ERP Tool Harness for Center Estates.
Supports DeepSeek R1/V3, OpenAI, Anthropic, NVIDIA NIM, and local Ollama endpoints.
Implements the core 'Detect -> Query System Tools -> Ground In Database -> Reason -> Human Approve' loop.
"""

import json
import os
import urllib.request
import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def execute_system_tool(
    tool_name: str,
    tool_args: Dict[str, Any],
    organization,
    user=None,
    request=None,
    allowed_modules=None,
) -> Dict[str, Any]:
    """Execute live database tools for Quartermaster AI Agent against Django ORM, scoped to user authorization."""
    if not organization:
        return {"error": "Organization context required."}

    # Verify module authorization
    if allowed_modules is not None:
        if tool_name in ("get_property_portfolio", "get_property_occupancy", "get_rent_arrears_summary") and "property" not in allowed_modules:
            return {"error": "Unauthorized for Property module."}
        if tool_name == "get_facility_work_orders" and "facility" not in allowed_modules:
            return {"error": "Unauthorized for Facility module."}

    try:
        from django.utils import timezone
        from core.property_scope import scope_model_queryset
        now = timezone.now()
        local_now = timezone.localtime(now)

        if tool_name == "get_current_datetime":
            return {
                "formatted_date_time": local_now.strftime("%A, %d %B %Y, %I:%M %p"),
                "date": local_now.strftime("%Y-%m-%d"),
                "day_of_week": local_now.strftime("%A"),
                "time": local_now.strftime("%H:%M:%S"),
                "timezone": str(timezone.get_current_timezone_name()),
                "year": local_now.year,
                "month_name": local_now.strftime("%B"),
            }

        elif tool_name in ("get_property_portfolio", "get_property_occupancy"):
            from properties.models import Property, Unit, Lease
            if request:
                props = scope_model_queryset(Property, request, organization)
            else:
                props = Property.objects.filter(organization=organization)

            prop_data = []
            for p in props.prefetch_related('units'):
                units = p.units.all()
                total_u = units.count()
                occupied_u = units.filter(status=Unit.Status.OCCUPIED).count()
                vacant_u = units.filter(status=Unit.Status.VACANT).count()
                prop_data.append({
                    "id": str(p.id),
                    "name": p.name,
                    "code": p.code,
                    "property_type": p.property_type,
                    "total_units": total_u,
                    "occupied_units": occupied_u,
                    "vacant_units": vacant_u,
                    "occupancy_rate": f"{round((occupied_u / max(total_u, 1)) * 100)}%",
                })
            return {
                "total_properties_in_portfolio": props.count(),
                "properties": prop_data,
                "portfolio_summary": f"Authorized access to {props.count()} property asset(s): " + ", ".join([f"{p.name} ({p.units.count()} units)" for p in props]),
            }

        elif tool_name == "get_rent_arrears_summary":
            from properties.models import Invoice
            if request:
                invoices = scope_model_queryset(Invoice, request, organization).filter(balance__gt=0).exclude(status=Invoice.Status.VOID).select_related('lease__tenant', 'lease__unit__property')
            else:
                invoices = Invoice.objects.filter(organization=organization, balance__gt=0).exclude(status=Invoice.Status.VOID).select_related('lease__tenant', 'lease__unit__property')

            total_arrears = sum(inv.balance for inv in invoices)
            overdue_tenants = [
                {
                    "invoice_number": inv.number,
                    "tenant_name": getattr(getattr(inv.lease, 'tenant', None), 'name', 'Unknown'),
                    "property_name": getattr(getattr(getattr(inv.lease, 'unit', None), 'property', None), 'name', ''),
                    "unit_code": getattr(getattr(inv.lease, 'unit', None), 'code', ''),
                    "balance_kes": float(inv.balance),
                    "due_on": inv.due_on.isoformat() if inv.due_on else None,
                }
                for inv in invoices[:15]
            ]
            return {
                "total_arrears_balance_kes": float(total_arrears),
                "delinquent_invoice_count": invoices.count(),
                "top_overdue_tenants": overdue_tenants,
            }

        elif tool_name == "get_calendar_events":
            from datetime import timedelta
            from properties.models import Lease, Invoice
            start_date = local_now.date()
            end_date = start_date + timedelta(days=30)
            events = []

            if allowed_modules is None or "property" in allowed_modules:
                if request:
                    expiries = scope_model_queryset(Lease, request, organization).filter(ends_on__gte=start_date, ends_on__lte=end_date).select_related('tenant', 'unit__property')
                    invoices_due = scope_model_queryset(Invoice, request, organization).filter(due_on__gte=start_date, due_on__lte=end_date, balance__gt=0).select_related('lease__tenant')
                else:
                    expiries = Lease.objects.filter(organization=organization, ends_on__gte=start_date, ends_on__lte=end_date).select_related('tenant', 'unit__property')
                    invoices_due = Invoice.objects.filter(organization=organization, due_on__gte=start_date, due_on__lte=end_date, balance__gt=0).select_related('lease__tenant')

                for l in expiries[:10]:
                    events.append({
                        "type": "lease_expiry",
                        "date": l.ends_on.isoformat(),
                        "title": f"Lease Expiring: {l.tenant.name} (Unit {l.unit.code}, {l.unit.property.name})",
                    })
                for inv in invoices_due[:10]:
                    events.append({
                        "type": "invoice_due",
                        "date": inv.due_on.isoformat(),
                        "title": f"Invoice Due: {inv.number} · KES {inv.balance:,.2f} ({getattr(getattr(inv.lease, 'tenant', None), 'name', 'Tenant')})",
                    })

            if allowed_modules is None or "facility" in allowed_modules:
                try:
                    from facilities.models import PreventiveSchedule
                    if request:
                        ppms = scope_model_queryset(PreventiveSchedule, request, organization).filter(is_active=True, next_due_on__gte=start_date, next_due_on__lte=end_date).select_related('asset')
                    else:
                        ppms = PreventiveSchedule.objects.filter(organization=organization, is_active=True, next_due_on__gte=start_date, next_due_on__lte=end_date).select_related('asset')
                    for ppm in ppms[:10]:
                        events.append({
                            "type": "ppm_due",
                            "date": ppm.next_due_on.isoformat(),
                            "title": f"PPM Due: {ppm.name} — {getattr(ppm.asset, 'name', 'General')}",
                        })
                except Exception:
                    pass

            events.sort(key=lambda e: e['date'])
            return {
                "today": start_date.isoformat(),
                "events_next_30_days": events,
            }

        elif tool_name == "get_facility_work_orders":
            from facilities.models import WorkOrder
            if request:
                orders = scope_model_queryset(WorkOrder, request, organization).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).select_related('property')
            else:
                orders = WorkOrder.objects.filter(organization=organization).exclude(status__in=(WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED)).select_related('property')

            return {
                "open_work_orders_count": orders.count(),
                "critical_orders": [
                    {
                        "reference": getattr(wo, 'reference', getattr(wo, 'number', str(wo.id))),
                        "title": wo.title,
                        "property": getattr(wo.property, 'name', ''),
                        "priority": wo.priority,
                        "status": wo.status,
                    } for wo in orders.filter(priority__in=('urgent', 'critical'))[:10]
                ]
            }

    except Exception as exc:
        logger.warning("Tool execution error (%s): %s", tool_name, exc)
        return {"error": str(exc)}

    return {"status": "unhandled_tool"}


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
            or ''
        )
        
        base_url = (
            os.environ.get('AI_ORCHESTRATOR_BASE_URL')
            or os.environ.get('OPENCODE_API_URL')
            or os.environ.get('DEEPSEEK_BASE_URL')
            or os.environ.get('NVIDIA_API_URL')
            or 'https://opencode.ai/zen/go/v1'
        ).rstrip('/')
        
        # Normalize legacy opencode host to the paid Go gateway base URL.
        if 'api.opencode.ai' in base_url:
            base_url = 'https://opencode.ai/zen/go/v1'
        
        self.api_url = f'{base_url}/chat/completions' if not base_url.endswith(('/chat/completions', '/responses')) else base_url
        self.uses_responses_api = self.api_url.endswith('/responses')
        self.model = (
            os.environ.get('AI_ORCHESTRATOR_MODEL')
            or os.environ.get('OPENCODE_MODEL')
            or os.environ.get('DEEPSEEK_MODEL')
            or os.environ.get('NVIDIA_MODEL')
            or 'deepseek-v4-flash'
        )
        # Map legacy/free model names to a Go subscription model.
        if 'opencode.ai' in self.api_url and self.model in (
            'deepseek-chat', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-5-nano', 'claude-haiku-4-5',
            'laguna-s-2.1-free', 'ling-3.0-flash-fin-free', 'nemotron-3.5-lightning-free',
            'nemotron-3-ultra-free',
        ):
            self.model = 'deepseek-v4-flash'
        timeout = os.environ.get('AI_TIMEOUT_SECONDS') or os.environ.get('NVIDIA_TIMEOUT_SECONDS') or '8'
        self.timeout_seconds = min(max(int(timeout), 3), 10)

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.api_url and self.model)

    def get_registered_tools(self) -> List[Dict[str, Any]]:
        """Standardized Tool Definitions exposed to the Agent Harness."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_current_datetime",
                    "description": "Fetch the exact live current date, time, day of the week, and calendar timezone.",
                    "parameters": {"type": "object", "properties": {}},
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_property_portfolio",
                    "description": "Fetch all registered properties in the organization portfolio with names, codes, types, and unit counts.",
                    "parameters": {"type": "object", "properties": {}},
                }
            },
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
                    "name": "get_calendar_events",
                    "description": "Query live calendar events (lease expirations, critical dates, invoice dues, PPM) for the next 30 days.",
                    "parameters": {"type": "object", "properties": {}},
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_facility_work_orders",
                    "description": "Fetch open, critical, and scheduled maintenance work orders and service requests.",
                    "parameters": {"type": "object", "properties": {}},
                }
            }
        ]

    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Simple chat completion wrapper."""
        if not self.configured:
            return {"content": "AI Gateway is not configured."}

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 700
        }

        try:
            req = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}',
                    'User-Agent': 'CenterEstates-ERP/1.0',
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8'))
                    raw_content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                    return {"content": raw_content.strip()}
        except Exception as err:
            logger.warning("AI Orchestrator chat() failed: %s", err)

        return {"content": "AI analysis temporarily unavailable."}

    def execute_agent(
        self, 
        prompt: str, 
        user_name: str, 
        context_str: str,
        organization=None,
        request=None,
        allowed_modules=None,
    ) -> dict:
        """Execute an intelligent Agent turn grounded in live database queries and tool executions."""
        if not self.configured:
            return {
                "agent": "Center Estates AI Copilot",
                "status": "local",
                "response": ""
            }

        from django.utils import timezone
        now = timezone.now()
        local_now = timezone.localtime(now)
        today_formatted = local_now.strftime("%A, %d %B %Y, %I:%M %p %Z")
        today_short = local_now.strftime("%A, %d %B %Y")

        # Proactive Agent Tool Execution based on user query intent and permissions
        tool_results = {}
        prompt_lower = prompt.lower()

        if any(term in prompt_lower for term in ("today", "date", "time", "day", "calendar", "when is")):
            tool_results["current_datetime"] = execute_system_tool("get_current_datetime", {}, organization, request=request, allowed_modules=allowed_modules)
            tool_results["calendar_events"] = execute_system_tool("get_calendar_events", {}, organization, request=request, allowed_modules=allowed_modules)

        if (allowed_modules is None or "property" in allowed_modules) and any(term in prompt_lower for term in ("property", "properties", "how many", "building", "units", "portfolio", "lynx", "boma")):
            tool_results["property_portfolio"] = execute_system_tool("get_property_portfolio", {}, organization, request=request, allowed_modules=allowed_modules)

        if (allowed_modules is None or "property" in allowed_modules) and any(term in prompt_lower for term in ("arrear", "debt", "overdue", "rent", "owe", "tenant", "collection")):
            tool_results["rent_arrears"] = execute_system_tool("get_rent_arrears_summary", {}, organization, request=request, allowed_modules=allowed_modules)

        if (allowed_modules is None or "facility" in allowed_modules) and any(term in prompt_lower for term in ("ticket", "work order", "facility", "repair", "maintenance")):
            tool_results["facility_work_orders"] = execute_system_tool("get_facility_work_orders", {}, organization, request=request, allowed_modules=allowed_modules)

        tool_results_str = json.dumps(tool_results, indent=2, default=str) if tool_results else ""

        system_instruction = (
            f"You are Quartermaster (QM), the autonomous AI Agent for {self.organization_name} ERP.\n"
            f"Operator: {user_name}\n"
            f"EXACT SYSTEM DATE & TIME: {today_formatted} (Today is {today_short}).\n\n"
            f"LIVE SYSTEM CONTEXT:\n{context_str}\n\n"
            + (f"LIVE TOOL EXECUTION RESULTS (Grounded Data):\n{tool_results_str}\n\n" if tool_results_str else "")
            + "CORE OPERATIONAL DIRECTIVES:\n"
            "1. TODAY'S DATE: You ALWAYS have full access to the live calendar and current date. If asked 'when is today' or about dates, state today's exact date ("
            + today_short
            + ") directly and confidently. NEVER state that you do not have access to date or time.\n"
            "2. ROLE & SCOPE BOUNDARIES: You operate strictly within the authorized scope of the logged-in operator. All data provided is already scoped to what the operator is authorized to see based on roles and permissions. Never include disclaimers, contrasts, or 'Note:' remarks about workspace filters or portfolio differences. Answer directly, factually, and concisely based only on the authorized records provided.\n"
            "3. YOU ARE AN AGENT, NOT A PASSIVE LLM: Ground all figures, names, and unit references in the live system data provided. Never hallucinate data.\n"
            "4. FORMATTING: Use crisp markdown with bullet points, bold figures (**KES 150,000**), and clear paragraphs. Keep answers direct and helpful.\n"
        )

        candidate_models = [self.model]
        for fallback in ('deepseek-v4-flash', 'glm-5.3-flash', 'minimax-m3', 'kimi-k2.6'):
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        for candidate in candidate_models:
            if self.uses_responses_api:
                payload = {
                    "model": candidate,
                    "input": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt},
                    ],
                    "max_output_tokens": 500,
                }
            else:
                payload = {
                    "model": candidate,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.15,
                    "max_tokens": 500
                }

            try:
                req = urllib.request.Request(
                    self.api_url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {self.api_key}',
                        'User-Agent': 'CenterEstates-ERP/1.0',
                    },
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=min(self.timeout_seconds, 8)) as res:
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
                            raw_content = data.get('choices', [{}])[0].get('message', {}).get('content')
                            agent_text = str(raw_content).strip() if raw_content and raw_content != 'None' else ''

                        if agent_text:
                            # Clean reasoning tokens or thinking logs if returned
                            agent_text = re.sub(r'<think>.*?</think>', '', agent_text, flags=re.DOTALL)
                            agent_text = re.sub(r'Here\'s a thinking process:.*?(?:---|(?=\n\n[A-Z0-9#*•]))', '', agent_text, flags=re.DOTALL).strip()

                        if agent_text:
                            return {
                                "agent": "Quartermaster AI",
                                "status": "success",
                                "response": agent_text,
                                "model": candidate,
                                "toolsExecuted": list(tool_results.keys()),
                                "toolsExposed": [t["function"]["name"] for t in self.get_registered_tools()]
                            }
            except Exception as err:
                logger.debug("Candidate model (%s) failed: %s; trying next fallback", candidate, type(err).__name__)
                continue

        return {
            "agent": "Quartermaster AI",
            "status": "unavailable",
            "response": ""
        }
