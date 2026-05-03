# routers/documents.py
import asyncio
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db, AsyncSessionLocal
from models.schemas import UploadResponse
from models.db_models import LoanSession
from utils.storage import save_upload
from utils.audit import audit
from utils.session import get_session_or_404

router = APIRouter()

ALLOWED_IMAGES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PDF    = {"application/pdf"}


@router.post("/upload/kyc-photo", response_model=UploadResponse)
async def upload_kyc_photo(
    session_id: UUID       = Form(...),
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """Step 2 — Upload the customer's KYC identity photo."""
    if file.content_type not in ALLOWED_IMAGES:
        raise HTTPException(400, "KYC photo must be JPEG, PNG or WEBP")

    session = await get_session_or_404(session_id, db)
    path    = await save_upload(session_id, "kyc_photo", file)
    session.kyc_photo_path = path
    await audit(db, session_id, "documents", "KYC_PHOTO_UPLOADED", path)
    await db.commit()

    return UploadResponse(session_id=session_id, doc_type="kyc_photo",
                          file_path=path, message="KYC photo uploaded")


@router.post("/upload/aadhaar-card", response_model=UploadResponse)
async def upload_aadhaar_card(
    session_id: UUID       = Form(...),
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """Upload the customer's Aadhaar card image."""
    if file.content_type not in ALLOWED_IMAGES:
        raise HTTPException(400, "Aadhaar card must be JPEG, PNG or WEBP")

    session = await get_session_or_404(session_id, db)
    path    = await save_upload(session_id, "aadhaar_card", file)
    session.aadhaar_card_path = path
    await audit(db, session_id, "documents", "AADHAAR_CARD_UPLOADED", path)
    await db.commit()

    return UploadResponse(session_id=session_id, doc_type="aadhaar_card",
                          file_path=path, message="Aadhaar card uploaded")


@router.post("/upload/pan-card", response_model=UploadResponse)
async def upload_pan_card(
    session_id: UUID       = Form(...),
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """Upload the customer's PAN card image."""
    if file.content_type not in ALLOWED_IMAGES:
        raise HTTPException(400, "PAN card must be JPEG, PNG or WEBP")

    session = await get_session_or_404(session_id, db)
    path    = await save_upload(session_id, "pan_card", file)
    session.pan_card_path = path
    await audit(db, session_id, "documents", "PAN_CARD_UPLOADED", path)
    await db.commit()

    return UploadResponse(session_id=session_id, doc_type="pan_card",
                          file_path=path, message="PAN card uploaded")


@router.post("/upload/bank-statement", response_model=UploadResponse)
async def upload_bank_statement(
    session_id: UUID       = Form(...),
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """Step 3 — Upload the customer's bank statement PDF."""
    if file.content_type not in ALLOWED_PDF:
        raise HTTPException(400, "Bank statement must be a PDF")

    session = await get_session_or_404(session_id, db)
    path    = await save_upload(session_id, "bank_statement", file)
    session.bank_statement_path = path
    await audit(db, session_id, "documents", "BANK_STATEMENT_UPLOADED", path)
    await db.commit()

    # Auto-trigger transaction agent in background
    asyncio.create_task(_run_transaction_background(session_id))

    return UploadResponse(session_id=session_id, doc_type="bank_statement",
                          file_path=path, message="Bank statement uploaded")


@router.post("/upload/live-frame", response_model=UploadResponse)
async def upload_live_frame(
    session_id: UUID       = Form(...),
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """Step 6 — Upload a captured frame from the live video call for DeepFace."""
    if file.content_type not in ALLOWED_IMAGES:
        raise HTTPException(400, "Live frame must be JPEG, PNG or WEBP")

    session = await get_session_or_404(session_id, db)
    path    = await save_upload(session_id, "live_frame", file)
    session.live_frame_path = path
    await audit(db, session_id, "documents", "LIVE_FRAME_UPLOADED", path)
    await db.commit()

    # Auto-trigger deepface agent in background
    asyncio.create_task(_run_deepface_background(session_id))

    return UploadResponse(session_id=session_id, doc_type="live_frame",
                          file_path=path, message="Live frame uploaded")


@router.get("/{session_id}/status")
async def doc_status(session_id: UUID, db: AsyncSession = Depends(get_db)):
    session = await get_session_or_404(session_id, db)
    return {
        "kyc_photo_uploaded":      bool(session.kyc_photo_path),
        "aadhaar_card_uploaded":   bool(session.aadhaar_card_path),
        "pan_card_uploaded":       bool(session.pan_card_path),
        "bank_statement_uploaded": bool(session.bank_statement_path),
        "live_frame_uploaded":     bool(session.live_frame_path),
    }


async def _run_transaction_background(session_id: UUID):
    from utils.transaction_pipeline import run_transaction_pipeline
    from utils.audit import audit
    from sqlalchemy import select
    import traceback
    
    async with AsyncSessionLocal() as db:
        try:
            print(f"📁 Auto-triggering transaction agent for {session_id}", flush=True)
            # Refresh session data in new DB session
            res = await db.execute(select(LoanSession).where(LoanSession.id == session_id))
            session = res.scalar_one_or_none()
            if not session: 
                print(f"⚠️ Session {session_id} not found in background task", flush=True)
                return

            result = await asyncio.get_event_loop().run_in_executor(
                None,
                run_transaction_pipeline,
                session.bank_statement_path,
                session.stated_income or 0,
                session.loan_type or "personal_loan_salaried",
                session.pdf_password,
            )
            # Update using the local session object
            session.transaction_output = result
            db.add(session) # Explicitly add to session
            await audit(db, session_id, "transaction", "AGENT_COMPLETED_AUTO",
                        f"income={result.get('monthly_income')}")
            await db.commit()
            print(f"✅ Auto-transaction complete for {session_id}", flush=True)
        except Exception as e:
            print(f"❌ Background transaction agent error for {session_id}: {e}", flush=True)
            traceback.print_exc()


async def _run_deepface_background(session_id: UUID):
    import base64, os, traceback
    from utils.audit import audit
    from sqlalchemy import select

    def _encode_image(path):
        if not path or not os.path.exists(path):
            return None
        with open(path, "rb") as f:
            return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()

    async with AsyncSessionLocal() as db:
        try:
            print(f"📸 Auto-triggering deepface agent for {session_id}", flush=True)
            # Refresh session data
            res = await db.execute(select(LoanSession).where(LoanSession.id == session_id))
            session = res.scalar_one_or_none()
            if not session: 
                print(f"⚠️ Session {session_id} not found in deepface background task", flush=True)
                return

            kyc_b64 = _encode_image(session.kyc_photo_path)
            live_b64 = _encode_image(session.live_frame_path)
            aadhaar_b64 = _encode_image(session.aadhaar_card_path)
            pan_b64 = _encode_image(session.pan_card_path)

            if not kyc_b64 or not live_b64:
                print(f"⚠️ Missing KYC photo or live frame for deepface background task: {session_id}", flush=True)
                return

            # CALL LOGIC DIRECTLY INSTEAD OF HTTP
            from agents.deepface_agent import process_kyc_logic
            face_data = await process_kyc_logic({
                "photo":   kyc_b64,
                "image":   live_b64,
                "aadhaar": aadhaar_b64,
                "pan":     pan_b64,
            })

            score = face_data.get("score", 0) or 0
            result = {
                "agent": "deepface", "status": "completed",
                "face_match": face_data.get("verified", False),
                "confidence": score,
                "distance": face_data.get("distance"),
                "face_status": face_data.get("status"),
                "estimated_age": None, "under_age": False,
                "liveness_passed": True, "error": None,
                # OCR results
                "aadhaar_number": face_data.get("aadhaar"),
                "aadhaar_status": face_data.get("aadhaar_status"),
                "aadhaar_valid": face_data.get("verhoeff") == "✅ Passed",
                "pan_number": face_data.get("pan"),
                "pan_status": face_data.get("pan_status"),
                "pan_valid": "Valid" in (face_data.get("pan_status") or ""),
            }
            session.deepface_output = result
            db.add(session) # Explicitly add to session
            await audit(db, session_id, "deepface", "AGENT_COMPLETED_AUTO",
                        f"match={result['face_match']} confidence={score:.2f}")
            await db.commit()
            print(f"✅ Auto-deepface complete for {session_id}", flush=True)
        except Exception as e:
            print(f"❌ Background deepface error for {session_id}: {e}", flush=True)
            traceback.print_exc()
            # Set a fallback in background task too
            try:
                fallback = {
                    "agent": "deepface", "status": "failed",
                    "face_match": False, "confidence": 0.0,
                    "error": str(e)
                }
                session.deepface_output = fallback
                db.add(session)
                await db.commit()
            except:
                pass

