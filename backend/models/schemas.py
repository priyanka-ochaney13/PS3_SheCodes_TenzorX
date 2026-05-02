# models/schemas.py
from __future__ import annotations
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


# ── Session ───────────────────────────────────────────────
class SessionCreateRequest(BaseModel):
    full_name:     Optional[str]   = None
    phone:         Optional[str]   = None
    email:         Optional[str]   = None
    kyc_address:   Optional[str]   = None
    stated_income: Optional[float] = None
    loan_type:     Optional[str]   = "personal_loan_salaried"
    pdf_password:  Optional[str]   = None
    ip_address:    Optional[str]   = None


class SessionResponse(BaseModel):
    session_id: UUID
    status:     str
    created_at: datetime

    class Config:
        from_attributes = True


class SessionStatusResponse(BaseModel):
    session_id:          UUID
    status:              str
    customer_name:       Optional[str]
    fraud_flag:          Optional[str]
    fraud_decision:      Optional[str]
    risk_score:          Optional[int]
    approved_amount:     Optional[int]
    interest_rate:       Optional[float]
    recommended_product: Optional[str] = None
    consent_given:       bool
    agents_completed:    List[str]

    class Config:
        from_attributes = True


# ── Document uploads ──────────────────────────────────────
class UploadResponse(BaseModel):
    session_id: UUID
    doc_type:   str
    file_path:  str
    message:    str


# ── Transcribe chunk (called per audio chunk during call) ─
class TranscribeResponse(BaseModel):
    session_id: UUID
    transcript: str
    question:   str


# ── Agent results ─────────────────────────────────────────
class AgentResultResponse(BaseModel):
    session_id: UUID
    agent:      str
    status:     str
    result:     Optional[Any] = None
    error:      Optional[str] = None


# ── Loan offer ────────────────────────────────────────────
class EMIOption(BaseModel):
    tenure_months:  int
    emi:            int
    total_interest: int
    total_payable:  int


class LoanOfferResponse(BaseModel):
    session_id:          UUID
    status:              str
    customer_name:       Optional[str]
    product_name:        Optional[str]
    approved_amount:     Optional[int]
    interest_rate:       Optional[float]
    recommended_tenure:  Optional[int]
    emi_options:         Optional[List[EMIOption]]
    processing_fee:      Optional[int]
    risk_score:          Optional[int]
    risk_level:          Optional[str]
    fraud_flag:          Optional[str]
    fraud_signals:       Optional[List[Any]]
    ineligibility_reason:Optional[str]


# ── Pipeline run ──────────────────────────────────────────
class PipelineRunRequest(BaseModel):
    session_id:    UUID
    geo_coords:    Optional[dict] = None   # {lat, lon}
    kyc_address:   Optional[str]  = None
    stated_income: Optional[float]= None


class PipelineRunResponse(BaseModel):
    session_id:   UUID
    fraud_flag:   str
    fraud_decision: str
    total_weight: int
    offer:        Optional[LoanOfferResponse] = None
    halted_reason:Optional[str]               = None
    agents_run:   List[str]


# ── Audit ─────────────────────────────────────────────────
class AuditLogResponse(BaseModel):
    id:         UUID
    session_id: UUID
    timestamp:  datetime
    agent:      str
    event:      str
    detail:     Optional[str]
    severity:   str

    class Config:
        from_attributes = True
