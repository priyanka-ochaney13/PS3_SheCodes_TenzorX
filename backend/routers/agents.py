# routers/agents.py
"""
Agent Communication Pattern
---------------------------
Each agent reads its inputs FROM the loan_session DB columns (not from disk files).
Each agent writes its output TO a loan_session DB column (not to disk files).

This is how agents communicate:
  speech_output      → read by: extractor_agent, fraud_detector_agent
  deepface_output    → read by: fraud_detector_agent, risk_agent, policy_agent
  transaction_output → read by: fraud_detector_agent, extractor_agent, risk_agent, policy_agent
  geo_output         → read by: fraud_detector_agent
  extractor_output   → read by: policy_agent, risk_agent, offer_agent
  fraud_output       → read by: risk_agent, offer_agent (halt check)
  policy_output      → read by: offer_agent, risk_agent
  risk_output        → read by: offer_agent

The JSON that used to be written to transcript_output.json, deepface_output.json etc.
is now stored in these DB columns. Same structure, same keys — just in Postgres, not on disk.
"""

import asyncio
import sys
import os
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.db_models import LoanSession, SessionStatus
from models.schemas import AgentResultResponse, TranscribeResponse
from utils.audit import audit
from utils.session import get_session_or_404
from utils.transaction_pipeline import run_transaction_pipeline
from utils.speech_config import STANDARD_QUESTIONS, CONVERSATIONAL_FRAUD_SYSTEM_PROMPT

# Make sure agents dir is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agents"))

router = APIRouter()


# ── Step 5: Transaction Agent ─────────────────────────────
@router.post("/transaction/{session_id}", response_model=AgentResultResponse)
async def run_transaction(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Runs the full transaction pipeline:
      pdf_tamper_detector → statement_parser → feature_engineer → xgboost_scorer

    Input:  session.bank_statement_path, session.stated_income, session.loan_type
    Output: stored in session.transaction_output
    """
    session = await get_session_or_404(session_id, db)

    if not session.bank_statement_path:
        raise HTTPException(400, "Bank statement not uploaded yet")

    await audit(db, session_id, "transaction", "AGENT_STARTED")
    await db.commit()

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            run_transaction_pipeline,
            session.bank_statement_path,
            session.stated_income or 0,
            session.loan_type or "personal_loan_salaried",
            session.pdf_password,
        )

        session.transaction_output = result
        await audit(db, session_id, "transaction", "AGENT_COMPLETED",
                    f"income=₹{result.get('monthly_income', 0):,} "
                    f"fraud_prob={result.get('fraud_probability', 0):.2f} "
                    f"tampered={result.get('pdf_tampered', False)}")
        await db.commit()

        return AgentResultResponse(session_id=session_id, agent="transaction",
                                   status="completed", result=result)
    except Exception as e:
        await audit(db, session_id, "transaction", "AGENT_FAILED", str(e), severity="error")
        await db.commit()
        raise HTTPException(500, f"Transaction agent error: {e}")


# ── Step 7: DeepFace Agent ────────────────────────────────
@router.post("/deepface/{session_id}", response_model=AgentResultResponse)
async def run_deepface(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Runs DeepFace face verification + age estimation.

    Input:  session.kyc_photo_path, session.live_frame_path
    Output: stored in session.deepface_output

    The deepface_agent.py runs as a separate FastAPI microservice on port 8001.
    This endpoint calls it internally.
    """
    session = await get_session_or_404(session_id, db)

    if not session.live_frame_path:
        raise HTTPException(400, "Live frame not uploaded yet. Upload it first.")
    if not session.kyc_photo_path:
        raise HTTPException(400, "KYC photo not uploaded yet.")
    if not session.aadhaar_card_path:
        raise HTTPException(400, "Aadhaar card not uploaded yet.")
    if not session.pan_card_path:
        raise HTTPException(400, "PAN card not uploaded yet.")

    await audit(db, session_id, "deepface", "AGENT_STARTED")
    await db.commit()

    try:
        import httpx, base64

        def _encode_image(path):
            if not path or not os.path.exists(path): return None
            with open(path, "rb") as f:
                return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()

        # Read all images and send to deepface microservice
        kyc_b64 = _encode_image(session.kyc_photo_path)
        live_b64 = _encode_image(session.live_frame_path)
        aadhaar_b64 = _encode_image(session.aadhaar_card_path)
        pan_b64 = _encode_image(session.pan_card_path)

        deepface_url = os.getenv("DEEPFACE_SERVICE_URL", "http://localhost:8001")

        async with httpx.AsyncClient(timeout=190) as client:
            face_res = await client.post(f"{deepface_url}/process_kyc_full", json={
                "photo":   kyc_b64,
                "image":   live_b64,
                "aadhaar": aadhaar_b64,
                "pan":     pan_b64,
            })

        face_data = face_res.json()
        score     = face_data.get("score", 0) or 0
        result    = {
            "agent":           "deepface",
            "status":          "completed",
            "face_match":      face_data.get("verified", False),
            "confidence":      score,
            "distance":        face_data.get("distance"),
            "face_status":     face_data.get("status"),
            "estimated_age":   None,
            "under_age":       False,
            "liveness_passed": True,
            "error":           None,
            # OCR results
            "aadhaar_number":  face_data.get("aadhaar"),
            "aadhaar_status":  face_data.get("aadhaar_status"),
            "aadhaar_valid":   face_data.get("verhoeff") == "✅ Passed",
            "pan_number":      face_data.get("pan"),
            "pan_status":      face_data.get("pan_status"),
            "pan_valid":       "Valid" in (face_data.get("pan_status") or ""),
        }

        session.deepface_output = result
        await audit(db, session_id, "deepface", "AGENT_COMPLETED",
                    f"match={result['face_match']} confidence={score:.2f}")
        await db.commit()

        return AgentResultResponse(session_id=session_id, agent="deepface",
                                   status="completed", result=result)

    except Exception as e:
        # Deepface service may not be running — store a graceful fallback
        fallback = {
            "agent": "deepface", "status": "failed",
            "face_match": False, "confidence": 0.0,
            "distance": None, "estimated_age": None,
            "under_age": False, "liveness_passed": False,
            "error": str(e),
        }
        session.deepface_output = fallback
        await audit(db, session_id, "deepface", "AGENT_FAILED", str(e), severity="error")
        await db.commit()
        # Don't raise — let pipeline continue with face_match=False signalled as fraud
        return AgentResultResponse(session_id=session_id, agent="deepface",
                                   status="failed", result=fallback, error=str(e))


# ── Step 8: Geo Agent ─────────────────────────────────────
@router.post("/geo/{session_id}", response_model=AgentResultResponse)
async def run_geo(
    session_id:  UUID,
    live_lat:    float = Form(...),
    live_lon:    float = Form(...),
    kyc_address: str   = Form(...),
    db:          AsyncSession = Depends(get_db),
):
    """
    Compares customer's live GPS coordinates against their KYC address.

    Input:  live_lat, live_lon (from browser), kyc_address (from form)
    Output: stored in session.geo_output
    """
    session = await get_session_or_404(session_id, db)
    await audit(db, session_id, "geo", "AGENT_STARTED",
                f"lat={live_lat} lon={live_lon}")
    await db.commit()

    try:
        from agents.geo_agent import GeoAgent

        agent  = GeoAgent(live_lat=live_lat, live_lon=live_lon, kyc_address=kyc_address)
        result = await asyncio.get_event_loop().run_in_executor(None, agent.run)

        session.geo_output = result
        await audit(db, session_id, "geo", "AGENT_COMPLETED",
                    f"distance={result.get('distance_km')}km risk={result.get('risk_level')}")
        await db.commit()

        return AgentResultResponse(session_id=session_id, agent="geo",
                                   status="completed", result=result)
    except Exception as e:
        await audit(db, session_id, "geo", "AGENT_FAILED", str(e), severity="error")
        await db.commit()
        raise HTTPException(500, f"Geo agent error: {e}")


# ── Step 9a: Transcribe a single audio chunk (called during call) ─────────
@router.post("/transcribe_chunk", response_model=TranscribeResponse)
async def transcribe_chunk(
    session_id: UUID       = Form(...),
    question:   str        = Form(...),
    audio:      UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
):
    """
    Called by VideoCallPage.jsx for each customer answer during the call.
    Receives an audio blob (webm), transcribes it via Groq Whisper.
    Returns the transcript text.
    """
    import tempfile, os as _os
    from groq import Groq

    await get_session_or_404(session_id, db)

    # Save audio to temp file
    content = await audio.read()
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        client = Groq(api_key=_os.getenv("GROQ_API_KEY"))
        with open(tmp_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=f,
                response_format="text",
                language="en",
            )
        transcript_text = str(response).strip() if response else ""
    except Exception as e:
        transcript_text = ""
        print(f"⚠️  Whisper error: {e}")
    finally:
        _os.unlink(tmp_path)

    return TranscribeResponse(
        session_id=session_id,
        transcript=transcript_text,
        question=question,
    )


# ── Step 9b: Save full speech output ─────────────────────
@router.post("/speech/{session_id}/save", response_model=AgentResultResponse)
async def save_speech_output(
    session_id:  UUID,
    speech_data: dict,
    db:          AsyncSession = Depends(get_db),
):
    """
    Step 9 — After the call ends, VideoCallPage sends the full assembled
    speech agent output (turns, transcript, fraud_signals, conversation_risk).

    Input:  JSON body matching transcript_output.json schema
    Output: stored in session.speech_output
    """
    session = await get_session_or_404(session_id, db)
    session.speech_output = speech_data

    # Record consent if detected in transcript
    turns = speech_data.get("turns", [])
    for turn in turns:
        if turn.get("role") == "customer":
            text = (turn.get("text") or "").lower()
            if any(w in text for w in ["yes", "i agree", "i consent", "agree"]):
                session.consent_given     = True
                session.consent_timestamp = datetime.utcnow()
                break

    await audit(db, session_id, "speech", "OUTPUT_SAVED",
                f"turns={len(turns)} risk={speech_data.get('conversation_risk')} "
                f"consent={session.consent_given}")
    await db.commit()

    # Check if all parallel agents are done — if so, auto-run pipeline
    if (session.speech_output and session.transaction_output
            and session.deepface_output and session.geo_output):
        asyncio.create_task(_run_pipeline_background(session_id, db))

    return AgentResultResponse(session_id=session_id, agent="speech",
                               status="saved", result=speech_data)


# ── Poll any agent result ─────────────────────────────────
@router.get("/{session_id}/{agent_name}/result", response_model=AgentResultResponse)
async def get_agent_result(
    session_id: UUID,
    agent_name: str,
    db: AsyncSession = Depends(get_db),
):
    valid = {"speech", "deepface", "transaction", "geo",
             "extractor", "fraud", "policy", "risk", "offer"}
    if agent_name not in valid:
        raise HTTPException(400, f"Unknown agent: {agent_name}")

    session = await get_session_or_404(session_id, db)
    result  = getattr(session, f"{agent_name}_output", None)

    return AgentResultResponse(
        session_id=session_id,
        agent=agent_name,
        status="completed" if result else "pending",
        result=result,
    )


# ── Fraud status check (called by ProcessingScreen.jsx) ──
@router.get("/{session_id}/fraud_status")
async def get_fraud_status(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Called by ProcessingScreen.jsx to check if pre-screen fraud gate passed."""
    session = await get_session_or_404(session_id, db)
    fraud   = session.fraud_output

    if not fraud:
        return {"fraud_verdict": "PENDING", "fraud_signals": [], "fraud_weight": 0}

    return {
        "fraud_verdict": fraud.get("flag", "GREEN"),
        "fraud_signals": fraud.get("signals", []),
        "fraud_weight":  fraud.get("total_weight", 0),
        "halt_pipeline": fraud.get("halt_pipeline", False),
    }


# ── Step 8a: TTS endpoint — convert text to audio ──────────
@router.post("/speech/{session_id}/speak")
async def speak_question(
    session_id: UUID,
    text: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Converts agent question text to audio via ElevenLabs.
    Returns audio bytes as streaming MP3 — frontend plays it directly.
    
    Input:  { "text": "What is your full name?" }
    Output: audio/mpeg stream (MP3 bytes)
    """
    import io
    
    await get_session_or_404(session_id, db)
    
    try:
        from elevenlabs.client import ElevenLabs
        elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        
        audio_stream = elevenlabs_client.text_to_speech.stream(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_turbo_v2_5",
        )
        audio_bytes = b"".join(c for c in audio_stream if isinstance(c, bytes))
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
        )
    except Exception as e:
        print(f"TTS error: {e}")
        raise HTTPException(500, f"TTS error: {e}")


# ── Step 8b: Get next question — LLM conversation control ──
@router.post("/speech/{session_id}/next_action")
async def get_next_action(
    session_id: UUID,
    turns: list = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Replicates get_next_action() from CLI SpeechAgent.
    Called after each customer answer to decide what to ask next.
    
    Frontend sends turns so far, gets back:
    - next question to ask (or closing statement)
    - whether to continue or end conversation
    - real-time fraud signals detected
    
    Input:  { "turns": [{"role": "agent", "text": "..."}, {"role": "customer", "text": "..."}] }
    Output: { "next_action", "next_question", "fraud_signals", "conversation_risk", "summary" }
    """
    import json
    import re
    
    await get_session_or_404(session_id, db)
    
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    # Build transcript so far
    transcript_so_far = "\n".join(
        f"{'Agent' if t['role'] == 'agent' else 'Customer'}: {t['text']}"
        for t in turns
    ) or "(No conversation yet. Start with the first question.)"
    
    standard_questions_text = "\n".join(f"- {q}" for q in STANDARD_QUESTIONS)
    
    prompt = f"""Here are the standard questions I need to ask:
{standard_questions_text}

Here is the conversation transcript so far:
{transcript_so_far}

Analyze the transcript and decide the next action based on the rules:
- If all standard questions have been asked and answered, output COMPLETE_CONVERSATION
- Otherwise, pick the next unanswered question or clarify inconsistencies
- Detect any fraud signals in the customer's responses
- Estimate the overall conversation risk so far"""
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CONVERSATIONAL_FRAUD_SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        result = json.loads(raw)
    except Exception as e:
        print(f"get_next_action error: {e}")
        result = {
            "next_action":       "COMPLETE_CONVERSATION",
            "next_question":     "Thank you for your time. We will now process your application.",
            "fraud_signals":     [],
            "conversation_risk": "low",
            "summary":           "",
        }
    
    return {
        "session_id":        str(session_id),
        "next_action":       result.get("next_action"),
        "next_question":     result.get("next_question"),
        "fraud_signals":     result.get("fraud_signals", []),
        "conversation_risk": result.get("conversation_risk", "low"),
        "summary":           result.get("summary", ""),
    }


# ── Step 8c: Final fraud analysis ────────────────────────
@router.post("/speech/{session_id}/analyze_fraud")
async def analyze_conversation_fraud(
    session_id: UUID,
    turns: list = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Replicates analyze_conversation_for_fraud() from CLI SpeechAgent.
    Called once at the end of the call, before /speech/{id}/save.
    Does a final deep analysis of the full transcript for fraud signals.
    
    Returns fraud_signals and conversation_risk to be included in speech_output.
    
    Input:  { "turns": [full conversation transcript] }
    Output: { "fraud_signals", "conversation_risk", "summary" }
    """
    import json
    import re
    
    await get_session_or_404(session_id, db)
    
    if not turns:
        return {
            "fraud_signals":     [],
            "conversation_risk": "low",
            "summary":           "No conversation to analyze.",
        }
    
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    transcript = "\n".join(
        f"{'Agent' if t['role'] == 'agent' else 'Customer'}: {t['text']}"
        for t in turns
    )
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CONVERSATIONAL_FRAUD_SYSTEM_PROMPT},
                {"role": "user",   "content": f"Analyze this complete loan onboarding transcript for fraud signals:\n\n{transcript}"},
            ],
            temperature=0.1,
            max_tokens=512,
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        result = json.loads(raw)
    except Exception as e:
        print(f"analyze_conversation_fraud error: {e}")
        result = {
            "fraud_signals":     [],
            "conversation_risk": "low",
            "summary":           "Analysis failed.",
        }
    
    return {
        "fraud_signals":     result.get("fraud_signals", []),
        "conversation_risk": result.get("conversation_risk", "low"),
        "summary":           result.get("summary", ""),
    }


async def _run_pipeline_background(session_id, db):
    try:
        from routers.loan import run_pipeline
        await run_pipeline(session_id, db)
    except Exception as e:
        print(f"Background pipeline error: {e}")
