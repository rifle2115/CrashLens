from datetime import datetime
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class LogEntryOut(BaseModel):
    id: int
    line_number: int
    level: str
    raw: str

    model_config = {"from_attributes": True}


class LogSessionOut(BaseModel):
    id: int
    filename: str
    total_lines: int
    summary: dict
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class LogSessionDetail(LogSessionOut):
    entries: list[LogEntryOut] = []
    errors: list[LogEntryOut] = []
    warnings: list[LogEntryOut] = []


# ── AI Chat ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
