# routers/session.py
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_db
from models.db_models import LoanSession, SessionStatus, AuditLog
from models.schemas import SessionCreateRequest, SessionResponse, SessionStatusResponse, AuditLogResponse, APIResponse
from utils.audit import audit
from utils.session import get_session_or_404

router = APIRouter()


@router.post("/create", response_model=SessionResponse, status_code=201)
async def create_session(body: SessionCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 1 — Called when customer submits the PreCallForm.
    Creates the session row and returns session_id used in every subsequent call.
    """
    session = LoanSession(
        customer_name  = body.full_name,
        customer_phone = body.phone,
        customer_email = body.email,
        kyc_address    = body.kyc_address,
        stated_income  = body.stated_income,
        loan_type      = body.loan_type,
        pdf_password   = body.pdf_password,
        ip_address     = body.ip_address,
        status         = SessionStatus.pending,
    )
    db.add(session)
    await db.flush()

    await audit(db, session.id, "session", "SESSION_CREATED",
                f"phone={body.phone} loan_type={body.loan_type}")
    await db.commit()
    await db.refresh(session)

    return SessionResponse(
        session_id=session.id,
        status=session.status.value,
        created_at=session.created_at,
    )


@router.post("/{session_id}/activate", response_model=APIResponse)
async def activate_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Step 4 — Call started. Mark session active."""
    session = await get_session_or_404(session_id, db)
    session.status = SessionStatus.active
    await audit(db, session_id, "session", "SESSION_ACTIVATED", "Video call started")
    await db.commit()
    return APIResponse(success=True, message="Session activated")


@router.post("/{session_id}/consent", response_model=APIResponse)
async def record_consent(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Called when customer clicks 'I Agree' on the consent modal in VideoCallPage."""
    session = await get_session_or_404(session_id, db)
    session.consent_given     = True
    session.consent_timestamp = datetime.utcnow()
    await audit(db, session_id, "session", "CONSENT_RECORDED",
                f"timestamp={datetime.utcnow().isoformat()}", severity="info")
    await db.commit()
    return APIResponse(success=True, message="Consent recorded")


@router.get("/{session_id}", response_model=SessionStatusResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    session = await get_session_or_404(session_id, db)
    completed = [
        a for a in ["speech", "deepface", "transaction", "geo",
                    "extractor", "fraud", "policy", "risk", "offer"]
        if getattr(session, f"{a}_output", None)
    ]
    return SessionStatusResponse(
        session_id          = session.id,
        status              = session.status.value,
        customer_name       = session.customer_name,
        fraud_flag          = session.fraud_flag,
        fraud_decision      = session.fraud_decision,
        risk_score          = session.risk_score,
        approved_amount     = session.approved_amount,
        interest_rate       = session.interest_rate,
        recommended_product = session.recommended_product,
        consent_given       = session.consent_given,
        agents_completed    = completed,
    )


@router.get("/{session_id}/audit", response_model=list[AuditLogResponse])
async def get_audit(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Step 12 — Full RBI-compliant audit trail for the session."""
    await get_session_or_404(session_id, db)
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.session_id == session_id)
        .order_by(AuditLog.timestamp)
    )
    return [AuditLogResponse.model_validate(log) for log in result.scalars().all()]


@router.delete("/{session_id}", response_model=APIResponse)
async def delete_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    from utils.storage import delete_session_files
    session = await get_session_or_404(session_id, db)
    delete_session_files(session_id)
    await db.delete(session)
    await db.commit()
    return APIResponse(success=True, message=f"Session {session_id} deleted")
