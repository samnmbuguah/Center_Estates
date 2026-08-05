"""
Quartermaster (QM) AI Agent Harness & ERP Tool Orchestrator for Center Estates.
Uses OpenCode API key (or OpenAI compatible key) to execute multi-tenant AI operations across ERP modules.
"""

import json
import os
import urllib.request
import urllib.error

class QMAgentOrchestrator:
    def __init__(self, organization_name: str = "Center Estates"):
        self.organization_name = organization_name
        self.api_key = os.environ.get('OPENCODE_API_KEY') or os.environ.get('OPENAI_API_KEY')
        self.api_url = os.environ.get('OPENCODE_API_URL') or 'https://api.opencode.ai/v1/chat/completions'
        self.model = os.environ.get('OPENCODE_MODEL', 'opencode-gpt-4o')

    def get_registered_tools(self):
        """Definitions of tools exposed to Quartermaster AI Agent harness"""
        return [
            {
                "name": "get_property_occupancy",
                "description": "Fetch portfolio building occupancy, total units, and active leases.",
                "parameters": {"type": "object", "properties": {"property_id": {"type": "string"}}}
            },
            {
                "name": "get_rent_arrears_summary",
                "description": "Get rent collection totals, overdue tenant list, and aged rent breakdown.",
                "parameters": {"type": "object", "properties": {"days_overdue": {"type": "integer"}}}
            },
            {
                "name": "get_facility_work_orders",
                "description": "Get open work orders, urgent asset maintenance alerts, and PPM schedule status.",
                "parameters": {"type": "object", "properties": {"status": {"type": "string"}}}
            },
            {
                "name": "get_construction_projects",
                "description": "Get active site projects, certified IPC payments, and open site tickets.",
                "parameters": {"type": "object", "properties": {"project_id": {"type": "string"}}}
            }
        ]

    def execute_agent(self, prompt: str, user_name: str, context_str: str) -> dict:
        """Executes a Quartermaster AI Agent turn using the OpenCode LLM key"""
        if not self.api_key:
            return {
                "agent": "Quartermaster (QM)",
                "status": "fallback",
                "response": "QM Agent API Key not configured."
            }

        system_instruction = (
            f"You are Quartermaster (QM) AI Agent for {self.organization_name}.\n"
            f"Active User: {user_name}\n"
            f"System Context:\n{context_str}\n\n"
            "Your role is to orchestrate ERP task execution, analyze operations, and recommend 1-click actions. "
            "Respond in clean markdown with bullet points and clear action recommendations."
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 600
        }

        try:
            req = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=12) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8'))
                    agent_text = data['choices'][0]['message']['content'].strip()
                    return {
                        "agent": "Quartermaster (QM)",
                        "status": "success",
                        "response": agent_text,
                        "toolsExposed": [t["name"] for t in self.get_registered_tools()]
                    }
        except Exception as err:
            print(f"QM Agent Exception: {err}")

        return {
            "agent": "Quartermaster (QM)",
            "status": "fallback",
            "response": ""
        }
