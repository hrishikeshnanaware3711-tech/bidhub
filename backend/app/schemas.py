from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PriorityType = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
StatusType = Literal["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]
FlagType = Literal["RED", "GREEN", "BLACK", "BLUE"]
RoleType = Literal["citizen", "admin"]


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=100)
    role: RoleType


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=100)
    role: RoleType


class LoginResponse(BaseModel):
    id: int
    name: str
    username: str
    role: RoleType


class RegistrationResponse(BaseModel):
    id: int
    name: str
    username: str
    role: RoleType


class AssignmentRequest(BaseModel):
    department_id: int
    priority: PriorityType


class StatusRequest(BaseModel):
    status: StatusType


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    reporter_name: str | None = None

    category: str
    description: str
    photo_url: str | None = None

    latitude: float
    longitude: float

    flag: str
    priority: str

    department_id: int | None = None
    department_name: str | None = None

    status: str

    ai_category: str | None = None
    ai_priority: str | None = None
    ai_summary: str | None = None
    ai_reason: str | None = None
    ai_emergency_risk: bool
    ai_status: str

    duplicate_of_id: int | None = None

    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class AIAnalysisOut(BaseModel):
    suggested_category: str
    flag: FlagType
    suggested_priority: PriorityType
    suggested_department: str
    summary: str = Field(max_length=500)
    reason: str = Field(max_length=700)
    emergency_risk: bool
    ai_status: str


class AIResponseBriefOut(BaseModel):
    risk_level: PriorityType
    response_actions: list[str]
    citizen_message: str
    admin_note: str
    tags: list[str]
    ai_status: str


class AIClosureOut(BaseModel):
    closure_title: str
    citizen_message: str
    resolution_summary: str
    follow_up_note: str
    ai_status: str


class AITranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    target_language: str = Field(min_length=2, max_length=40)


class AITranslateOut(BaseModel):
    target_language: str
    translated_text: str
    ai_status: str


class AIQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class AIQuestionOut(BaseModel):
    answer: str
    data_points: list[str]
    ai_status: str


class AIAreaBriefOut(BaseModel):
    area_label: str
    summary: str
    top_concerns: list[str]
    hotspots: list[str]
    recommended_focus: list[str]
    ai_status: str


class AIClusterItem(BaseModel):
    name: str
    issue_ids: list[int]
    summary: str


class AIClustersOut(BaseModel):
    clusters: list[AIClusterItem]
    ai_status: str
