# models/db_models.py
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, JSON, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.database import Base


class SessionStatus(str, enum.Enum):
    pending   = "pending"
    active    = "active"
    completed = "completed"
    halted    = "halted"
    failed    = "failed"


class LoanSession(Base):
    __tablename__ = "loan_sessions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status         = Column(SAEnum(SessionStatus), default=SessionStatus.pending)

    # Customer info
    customer_name  = Column(String(256), nullable=True)
    customer_phone = Column(String(20),  nullable=True)
    customer_email = Column(String(256), nullable=True)
    kyc_address    = Column(Text, nullable=True)
    loan_type      = Column(String(100), nullable=True)
    stated_income  = Column(Integer, nullable=True)
    pdf_password   = Column(String(256), nullable=True)

    # Document paths
    kyc_photo_path      = Column(String(1024), nullable=True)
    aadhaar_card_path   = Column(String(1024), nullable=True)
    pan_card_path       = Column(String(1024), nullable=True)
    bank_statement_path = Column(String(1024), nullable=True)
    live_frame_path     = Column(String(1024), nullable=True)

    # Agent outputs (JSON)
    speech_output      = Column(JSON, nullable=True)
    deepface_output    = Column(JSON, nullable=True)
    transaction_output = Column(JSON, nullable=True)
    geo_output         = Column(JSON, nullable=True)
    extractor_output   = Column(JSON, nullable=True)
    fraud_output       = Column(JSON, nullable=True)
    policy_output      = Column(JSON, nullable=True)
    risk_output        = Column(JSON, nullable=True)
    offer_output       = Column(JSON, nullable=True)

    # Quick-access summary fields 
    # (denormalised for fast API responses)
    fraud_flag          = Column(String(20), nullable=True)
    fraud_decision      = Column(String(20), nullable=True)
    risk_score          = Column(Integer, nullable=True)
    approved_amount     = Column(Integer, nullable=True)
    interest_rate       = Column(Float, nullable=True)
    recommended_product = Column(String(100), nullable=True)

    # Compliance
    consent_given     = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime, nullable=True)
    ip_address        = Column(String(64), nullable=True)

    audit_logs = relationship("AuditLog", back_populates="session", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("loan_sessions.id"), nullable=False)
    timestamp  = Column(DateTime, default=datetime.utcnow)
    agent      = Column(String(50),  nullable=False)
    event      = Column(String(100), nullable=False)
    detail     = Column(Text, nullable=True)
    severity   = Column(String(20), default="info")  # info | warn | error | critical

    session = relationship("LoanSession", back_populates="audit_logs")
