from typing import Any, Dict, List, Optional, TypedDict, Union
from pydantic import BaseModel, Field


class AgentAction(BaseModel):
    """A proposed actionable intervention in the ERP."""
    id: str = Field(..., description="Unique action identifier")
    action_type: str = Field(..., description="Type: send_payment_reminder, dispatch_work_order, renew_lease, assign_task, approve_leave")
    title: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Rationale and context for this action")
    target_module: str = Field(..., description="Target module (property, facility, companion, etc.)")
    target_id: Optional[str] = Field(None, description="Primary record UUID or reference")
    target_name: Optional[str] = Field(None, description="Name of tenant, asset, contractor, or staff member")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Execution payload parameters")
    urgency: str = Field("medium", description="Urgency: low, medium, high, critical")
    status: str = Field("pending", description="Status: pending, approved, executed, rejected")


class DailyBriefingData(BaseModel):
    """Synthesized executive daily briefing."""
    date: str
    headline: str
    portfolio_health_score: int
    health_status: str
    key_metrics: Dict[str, Any]
    critical_alerts: List[str]
    leasing_summary: str
    maintenance_summary: str
    collections_summary: str
    hr_summary: str
    recommended_focus: List[str]
    actions: List[AgentAction]


class AgentState(TypedDict, total=False):
    """
    Central State for the LangGraph Orchestrator.
    Passed between graph nodes during the 4-phase cognitive cycle.
    """
    # Context
    organization_id: str
    user_id: Optional[str]
    user_name: str
    user_role: str
    mode: str  # 'briefing', 'chat', 'autonomous_audit', 'action_execution'
    # Property scope — mirrors the X-Property-ID the user has active in the app.
    # None means portfolio-wide (all properties the user can access).
    active_property_id: Optional[str]
    active_property_name: Optional[str]
    # Allowed modules based on user subscription, roles, and permissions
    allowed_modules: Optional[List[str]]
    
    # Input
    input_query: str
    conversation_history: List[Dict[str, str]]
    
    # Phase 1: Ingested Domain Findings
    raw_findings: Dict[str, Any]
    financial_data: Dict[str, Any]
    facility_data: Dict[str, Any]
    leasing_data: Dict[str, Any]
    team_data: Dict[str, Any]
    
    # Phase 2: Synthesis & Explanations
    health_score: int
    insights: List[str]
    daily_briefing: Optional[Dict[str, Any]]
    
    # Phase 3: Propose Interventions
    proposed_actions: List[Dict[str, Any]]
    
    # Phase 4: Human-in-the-Loop Execution
    approved_action_ids: List[str]
    execution_results: List[Dict[str, Any]]
    
    # Final Output
    final_response: str
    tools_executed: List[str]
    error: Optional[str]
    iteration_count: int
