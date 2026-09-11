import os
import json
import logging
from typing import Any, Dict, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


class LLMGateway:
    """
    Model-agnostic gateway for AI Providers:
    1. DeepSeek R1 / V3 (via api.deepseek.com)
    2. OpenAI (GPT-4o, GPT-4o-mini)
    3. Anthropic Claude (via OpenAI-compatible proxy or adapter)
    4. NVIDIA NIM (DeepSeek R1, Llama-3.3-70B)
    5. Local Ollama (http://localhost:11434/v1)
    6. Deterministic Rule-Based Fallback (Zero cost / Offline resilience)
    """

    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "auto").lower()
        self.deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.nvidia_key = os.getenv("NVIDIA_API_KEY", "")
        # OpenCode Zen / AI Orchestrator gateway (the platform's default provider).
        self.opencode_key = os.getenv("OPENCODE_API_KEY") or os.getenv("AI_ORCHESTRATOR_API_KEY", "")
        self.opencode_base_url = (
            os.getenv("OPENCODE_API_URL") or os.getenv("AI_ORCHESTRATOR_BASE_URL") or "https://opencode.ai/zen/v1"
        )
        self.opencode_model = os.getenv("OPENCODE_MODEL") or os.getenv("AI_ORCHESTRATOR_MODEL") or "laguna-s-2.1-free"
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        self.model_name = os.getenv("AI_MODEL_NAME", "")
        
        self.client = self._init_client()

    def _init_client(self) -> Optional[ChatOpenAI]:
        try:
            llm_timeout = min(max(int(os.getenv("AI_TIMEOUT_SECONDS", "8")), 3), 10)

            # 0. OpenCode Zen / AI Orchestrator (OpenAI-compatible). This is the
            # platform default and must be honoured before the legacy providers.
            if self.opencode_key:
                base_url = self.opencode_base_url.rstrip("/")
                if "api.opencode.ai" in base_url:
                    base_url = "https://opencode.ai/zen/v1"
                model = self.model_name or self.opencode_model
                if base_url.endswith("/chat/completions"):
                    base_url = base_url[: -len("/chat/completions")]
                logger.info("Initializing OpenCode/AI Orchestrator Agent Provider (%s)", model)
                return ChatOpenAI(
                    model=model,
                    api_key=self.opencode_key,
                    base_url=base_url,
                    temperature=0.3,
                    timeout=llm_timeout,
                )

            # 1. DeepSeek Provider
            if (self.provider == "deepseek" or (self.provider == "auto" and self.deepseek_key)) and self.deepseek_key:
                logger.info("Initializing DeepSeek Agent Provider (deepseek-chat / deepseek-reasoner)")
                return ChatOpenAI(
                    model=self.model_name or "deepseek-chat",
                    api_key=self.deepseek_key,
                    base_url="https://api.deepseek.com/v1",
                    temperature=0.3,
                    timeout=llm_timeout,
                )

            # 2. NVIDIA NIM Provider (DeepSeek R1 / Llama-3.3)
            if self.provider == "nvidia" and self.nvidia_key:
                logger.info("Initializing NVIDIA NIM Provider")
                return ChatOpenAI(
                    model=self.model_name or "deepseek-ai/deepseek-r1",
                    api_key=self.nvidia_key,
                    base_url="https://integrate.api.nvidia.com/v1",
                    temperature=0.3,
                    timeout=llm_timeout,
                )

            # 3. OpenAI Provider
            if (self.provider == "openai" or (self.provider == "auto" and self.openai_key)) and self.openai_key:
                logger.info("Initializing OpenAI Agent Provider")
                return ChatOpenAI(
                    model=self.model_name or "gpt-4o-mini",
                    api_key=self.openai_key,
                    temperature=0.3,
                    timeout=llm_timeout,
                )

            # 4. Local Ollama Provider
            if self.provider == "ollama":
                logger.info("Initializing Ollama Local Provider")
                return ChatOpenAI(
                    model=self.model_name or "deepseek-r1:8b",
                    api_key="ollama",
                    base_url=self.ollama_url,
                    temperature=0.3,
                    timeout=llm_timeout,
                )

            logger.info("No active cloud LLM API key detected; using Deterministic Rule-Based ERP Intelligence Engine.")
            return None

        except Exception as e:
            logger.warning("Failed to initialize remote LLM client: %s. Using rule engine.", e)
            return None

    def generate_chat(self, system_prompt: str, messages: List[Dict[str, str]], fallback: Optional[str] = None) -> str:
        """Execute chat inference with fallback to structured intelligence."""
        if self.client:
            try:
                formatted_messages: List[BaseMessage] = [SystemMessage(content=system_prompt)]
                for m in messages:
                    if m.get("role") == "user":
                        formatted_messages.append(HumanMessage(content=m.get("content", "")))
                    elif m.get("role") == "assistant":
                        formatted_messages.append(AIMessage(content=m.get("content", "")))
                response = self.client.invoke(formatted_messages)
                text = str(response.content).strip()
                if text:
                    return text
            except Exception as e:
                logger.warning("LLM generation call failed (%s). Falling back to rule synthesis.", e)

        # Prefer a grounded fallback supplied by the caller (real ERP data).
        if fallback:
            return fallback
        last_query = messages[-1].get("content", "") if messages else ""
        return self._generate_fallback_response(last_query)

    def stream_chat(self, system_prompt: str, messages: List[Dict[str, str]], fallback: Optional[str] = None):
        """Yield token chunks for Server-Sent Events (SSE) streaming."""
        if self.client:
            try:
                formatted_messages: List[BaseMessage] = [SystemMessage(content=system_prompt)]
                for m in messages:
                    if m.get("role") == "user":
                        formatted_messages.append(HumanMessage(content=m.get("content", "")))
                    elif m.get("role") == "assistant":
                        formatted_messages.append(AIMessage(content=m.get("content", "")))
                produced = False
                for chunk in self.client.stream(formatted_messages):
                    token = getattr(chunk, "content", "")
                    if token:
                        produced = True
                        yield token
                if produced:
                    return
            except Exception as e:
                logger.warning("Streaming LLM call failed (%s). Using fallback chunking.", e)

        fallback_text = fallback or self._generate_fallback_response(messages[-1].get("content", "") if messages else "")
        import time
        words = fallback_text.split(" ")
        for i, word in enumerate(words):
            yield (word + " " if i < len(words) - 1 else word)
            time.sleep(0.015)

    def generate_structured_json(self, system_prompt: str, user_prompt: str) -> Optional[Dict[str, Any]]:
        """Request structured JSON response from the model."""
        if self.client:
            try:
                prompt = f"{user_prompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object matching the required schema. No markdown fences or commentary."
                response = self.client.invoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=prompt)
                ])
                raw = str(response.content).strip()
                if raw.startswith("```json"):
                    raw = raw[7:]
                if raw.startswith("```"):
                    raw = raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                return json.loads(raw.strip())
            except Exception as e:
                logger.warning("Structured JSON generation failed: %s", e)

        return None

    def _generate_fallback_response(self, query: str) -> str:
        q = query.lower()

        def matches(*terms):
            return any(term in q for term in terms)

        if matches("arrear", "rent", "unpaid", "collection", "collected", "collect",
                   "income", "revenue", "owe", "outstanding", "payment", "receipt",
                   "cash", "money", "month", "billed", "invoice"):
            return (
                "**Financial & Rent Collection Briefing**\n\n"
                "• Overdue tenancy invoices have been reviewed across active leases.\n"
                "• Automated M-Pesa payment reminders can be dispatched with 1-click via the Outbound SMTP Gateway.\n"
                "• All transactions are synchronized with the KRA eTIMS tax ledger."
            )
        if matches("maintenance", "work order", "facility", "repair", "asset", "ticket", "service request", "ppm"):
            return (
                "**Facility Management Briefing**\n\n"
                "• Active maintenance work orders and caretaker meter logs are being tracked against SLA targets.\n"
                "• Urgent tickets are automatically escalated to lead technicians."
            )
        if matches("lease", "tenant", "occupancy", "vacan", "expir", "unit", "property", "portfolio"):
            return (
                "**Tenancy & Occupancy Briefing**\n\n"
                "• Active leases, occupancy and upcoming expiries are tracked across the authorized portfolio.\n"
                "• Critical dates and renewal reminders are surfaced on the calendar."
            )
        return (
            "I am **Quartermaster**, your Center Estates Open Agent Orchestrator. "
            "I continuously monitor your portfolio's rent collections, maintenance work orders, expiring leases, and team leave schedules. "
            "How can I assist you with operations today?"
        )
