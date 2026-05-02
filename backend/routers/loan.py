# routers/loan.py
"""
Loan Pipeline Router
--------------------
POST /loan/pipeline/{id}  — runs the full sequential decision pipeline
POST /loan/generate/{id}  — generate offer only (called by VideoCallPage after pipeline)
GET  /loan/{id}/summary   — compact result for display on screen
"""

import asyncio
import sys
import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.db_models import LoanSession, SessionStatus
from models.schemas import LoanOfferResponse, PipelineRunResponse, EMIOption
from utils.audit import audit
from utils.session import get_session_or_404

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agents"))

router = APIRouter()


# ── Step 10: Full pipeline ────────────────────────────────
@router.post("/pipeline/{session_id}", response_model=PipelineRunResponse)
async def run_pipeline(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Runs the sequential decision pipeline:
      Extractor → Fraud Gate → Policy → Risk → Offer

    Reads from:  speech_output, transaction_output, deepface_output, geo_output
    Writes to:   extractor_output, fraud_output, policy_output, risk_output, offer_output
    """
    session    = await get_session_or_404(session_id, db)
    agents_run = []

    await audit(db, session_id, "pipeline", "PIPELINE_STARTED")
    await db.commit()

    # ── Guard: minimum required inputs ───────────────────
    if not session.speech_output:
        raise HTTPException(400, "speech_output missing — save speech output first.")
    if not session.transaction_output:
        raise HTTPException(400, "transaction_output missing — wait for bank statement processing.")

    # ── Extractor ─────────────────────────────────────────
    if not session.extractor_output:
        try:
            from agents.extractor_agent import ExtractorAgent
            agent  = ExtractorAgent(
                transcript_output  = session.speech_output,
                transaction_output = session.transaction_output,
            )
            result = await asyncio.get_event_loop().run_in_executor(None, agent.run)
            session.extractor_output = result
            schema = result.get("loan_schema", {})
            if schema.get("customer_name"):
                session.customer_name = schema["customer_name"]
            agents_run.append("extractor")
            await audit(db, session_id, "extractor", "AGENT_COMPLETED",
                        f"name={schema.get('customer_name')} "
                        f"amount={schema.get('requested_amount')} "
                        f"purpose={schema.get('loan_purpose')}")
            await db.commit()
        except Exception as e:
            await audit(db, session_id, "extractor", "AGENT_FAILED", str(e), severity="error")
            await db.commit()
            raise HTTPException(500, f"Extractor failed: {e}")

    # ── Fraud Detector ────────────────────────────────────
    if not session.fraud_output:
        try:
            from agents.fraud_detector_agent import fraud_detector_agent

            speech      = session.speech_output or {}
            deepface    = session.deepface_output or {}
            transaction = session.transaction_output or {}
            geo         = session.geo_output or {}

            pan_result     = {"valid": deepface.get("pan_valid", True),
                              "reason": deepface.get("pan_status", "")}
            aadhaar_result = {"valid": deepface.get("aadhaar_valid", True),
                              "reason": deepface.get("aadhaar_status", "")}
            photo_result   = {"fraud_signal": False}
            face_score     = deepface.get("confidence", 0) or 0

            geo_flag = geo.get("flag") or ""
            if "RED" in geo_flag:
                geo_extra = [{"source": "GEO_RED",    "detail": geo_flag, "weight": 2}]
            elif "YELLOW" in geo_flag:
                geo_extra = [{"source": "GEO_YELLOW", "detail": geo_flag, "weight": 1}]
            else:
                geo_extra = []

            conversation_result = {
                "fraud_signals": [
                    {"detail": sig, "weight": 2}
                    for sig in (speech.get("fraud_signals") or [])
                ]
            }

            result = fraud_detector_agent(
                pan_result          = pan_result,
                aadhaar_result      = aadhaar_result,
                photo_result        = photo_result,
                face_match_score    = face_score,
                tampering_result    = transaction.get("tampering_result") or
                                      {"signals": [], "total_weight": 0},
                features            = transaction,
                xgboost_result      = transaction.get("xgboost_result") or
                                      {"fraud_signal": False, "fraud_probability": 0.0, "weight": 0},
                conversation_result = conversation_result,
                applicant_id        = str(session_id),
            )

            # Fold geo signals in
            if geo_extra:
                result["signals"].extend(geo_extra)
                result["total_weight"] += sum(s["weight"] for s in geo_extra)
                w = result["total_weight"]
                if   w <= 2: result["flag"], result["action"], result["halt_pipeline"] = "GREEN",  "PROCEED_TO_CREDIT_DECISION", False
                elif w <= 5: result["flag"], result["action"], result["halt_pipeline"] = "YELLOW", "PROCEED_WITH_CAUTION",       False
                elif w <= 9: result["flag"], result["action"], result["halt_pipeline"] = "ORANGE", "ADDITIONAL_VERIFICATION",    False
                else:        result["flag"], result["action"], result["halt_pipeline"] = "RED",    "HARD_HALT",                  True

            session.fraud_output   = result
            session.fraud_flag     = result["flag"]
            session.fraud_decision = "halt" if result["halt_pipeline"] else "proceed"
            agents_run.append("fraud")

            sev = "critical" if result["halt_pipeline"] else "info"
            await audit(db, session_id, "fraud", "AGENT_COMPLETED",
                        f"flag={result['flag']} weight={result['total_weight']} "
                        f"signals={result['signal_count']}",
                        severity=sev)
            await db.commit()

        except Exception as e:
            await audit(db, session_id, "fraud", "AGENT_FAILED", str(e), severity="error")
            await db.commit()
            raise HTTPException(500, f"Fraud detector failed: {e}")

    # ── HALT CHECK ────────────────────────────────────────
    if session.fraud_output.get("halt_pipeline"):
        session.status = SessionStatus.halted
        await audit(db, session_id, "pipeline", "PIPELINE_HALTED",
                    f"flag=RED weight={session.fraud_output.get('total_weight')}",
                    severity="critical")
        await db.commit()
        return PipelineRunResponse(
            session_id     = session_id,
            fraud_flag     = "RED",
            fraud_decision = "halt",
            total_weight   = session.fraud_output.get("total_weight", 0),
            agents_run     = agents_run,
            halted_reason  = "Fraud detection threshold exceeded — pipeline halted",
        )

    # ── Policy Agent ──────────────────────────────────────
    if not session.policy_output:
        try:
            from agents.policy_agent import PolicyAgent
            agent  = PolicyAgent(
                loan_schema        = session.extractor_output.get("loan_schema", {}),
                deepface_output    = session.deepface_output or {},
                transaction_output = session.transaction_output or {},
            )
            result = await asyncio.get_event_loop().run_in_executor(None, agent.run)
            session.policy_output       = result
            session.recommended_product = result.get("recommended_product")
            agents_run.append("policy")
            await audit(db, session_id, "policy", "AGENT_COMPLETED",
                        f"status={result.get('status')} "
                        f"products={len(result.get('eligible_products', []))}")
            await db.commit()
        except Exception as e:
            await audit(db, session_id, "policy", "AGENT_FAILED", str(e), severity="error")
            await db.commit()
            raise HTTPException(500, f"Policy agent failed: {e}")

    # ── Risk Scorer ───────────────────────────────────────
    if not session.risk_output:
        try:
            from agents.risk_agent import (
                calculate_risk, RiskRequest,
                LoanSchema       as RiskLoanSchema,
                DeepFaceOutput   as RiskDeepFaceOutput,
                TransactionOutput as RiskTransactionOutput,
                FraudOutput      as RiskFraudOutput,
            )

            schema      = session.extractor_output.get("loan_schema", {})
            deepface    = session.deepface_output or {}
            transaction = session.transaction_output or {}
            fraud       = session.fraud_output or {}

            risk_request = RiskRequest(
                loan_schema = RiskLoanSchema(
                    credit_score_self_reported = int(schema.get("credit_score_self_reported") or 700),
                    employment_type            = schema.get("employment_type") or "unknown",
                    employer_category          = schema.get("employer_category") or "other",
                    employer_name              = schema.get("employer_name") or "",
                    monthly_income             = int(transaction.get("monthly_income") or 0),
                    requested_amount           = int(schema.get("requested_amount") or 0),
                ),
                deepface_output = RiskDeepFaceOutput(
                    estimated_age = int(deepface.get("estimated_age") or 30),
                    face_match    = deepface.get("face_match", False),
                ),
                transaction_output = RiskTransactionOutput(
                    monthly_income = int(transaction.get("monthly_income") or 0),
                    bounce_count   = int(transaction.get("bounce_count") or 0),
                    risk_flags     = transaction.get("risk_flags") or [],
                ),
                fraud_output = RiskFraudOutput(
                    weighted_score  = float(fraud.get("total_weight") or 0),
                    conv_risk_level = (session.speech_output or {}).get("conversation_risk", "low"),
                    flags           = [s.get("source", "") for s in (fraud.get("signals") or [])],
                ),
            )

            result           = await asyncio.get_event_loop().run_in_executor(None, calculate_risk, risk_request)
            result["agent"]  = "risk_scorer"
            result["status"] = "completed"

            session.risk_output = result
            session.risk_score  = result.get("risk_score")
            agents_run.append("risk")
            await audit(db, session_id, "risk", "AGENT_COMPLETED",
                        f"score={result.get('risk_score')} level={result.get('risk_level')}")
            await db.commit()

        except Exception as e:
            await audit(db, session_id, "risk", "AGENT_FAILED", str(e), severity="error")
            await db.commit()
            raise HTTPException(500, f"Risk scorer failed: {e}")

    # ── Offer Engine ──────────────────────────────────────
    if not session.offer_output:
        try:
            from agents.offer_agent import (
                generate_offer, OfferRequest,
                LoanSchema    as OfferLoanSchema,
                PolicyOutput  as OfferPolicyOutput,
                PolicyProduct,
                RiskOutput    as OfferRiskOutput,
            )

            schema = session.extractor_output.get("loan_schema", {})
            policy = session.policy_output or {}
            risk   = session.risk_output   or {}

            eligible_products_raw = policy.get("eligible_products") or [
                {"key": "personal_loan", "name": "Personal Loan",
                 "min_amount": 100000, "max_amount": 5000000, "max_tenure": 84}
            ]

            eligible_products = [
                PolicyProduct(
                    key        = p.get("key", "personal_loan"),
                    name       = p.get("name", "Personal Loan"),
                    min_amount = int(p.get("min_amount", 100000)),
                    max_amount = int(p.get("max_amount", 5000000)),
                    max_tenure = int(p.get("max_tenure", 84)),
                )
                for p in eligible_products_raw
            ]

            offer_request = OfferRequest(
                loan_schema = OfferLoanSchema(
                    customer_name           = schema.get("customer_name") or "",
                    requested_amount        = int(schema.get("requested_amount") or 500000),
                    loan_tenure_preference  = schema.get("loan_tenure_preference"),
                ),
                policy_output = OfferPolicyOutput(
                    status               = policy.get("status", "eligible"),
                    max_eligible_amount  = int(policy.get("max_eligible_amount", 0)),
                    recommended_product  = policy.get("recommended_product", "personal_loan"),
                    eligible_products    = eligible_products,
                ),
                risk_output = OfferRiskOutput(
                    risk_score       = int(risk.get("risk_score", 50)),
                    risk_level       = risk.get("risk_level", "MEDIUM RISK"),
                    reduction_factor = _compute_reduction(int(risk.get("risk_score", 50))),
                    action           = risk.get("action", "VERIFICATION REQUIRED"),
                ),
            )

            result = await asyncio.get_event_loop().run_in_executor(None, generate_offer, offer_request)

            session.offer_output    = result
            session.approved_amount = result.get("approved_amount")
            session.interest_rate   = result.get("interest_rate")
            agents_run.append("offer")
            await audit(db, session_id, "offer", "AGENT_COMPLETED",
                        f"status={result.get('status')} "
                        f"amount={result.get('approved_amount')} "
                        f"rate={result.get('interest_rate')}")
            await db.commit()

        except Exception as e:
            await audit(db, session_id, "offer", "AGENT_FAILED", str(e), severity="error")
            await db.commit()
            raise HTTPException(500, f"Offer engine failed: {e}")

    # ── Done ──────────────────────────────────────────────
    session.status = SessionStatus.completed
    await audit(db, session_id, "pipeline", "PIPELINE_COMPLETED",
                f"agents={agents_run} score={session.risk_score} amount={session.approved_amount}")
    await db.commit()

    offer_resp = _build_offer_response(session_id, session.offer_output, session)

    return PipelineRunResponse(
        session_id     = session_id,
        fraud_flag     = session.fraud_flag or "GREEN",
        fraud_decision = session.fraud_decision or "proceed",
        total_weight   = (session.fraud_output or {}).get("total_weight", 0),
        offer          = offer_resp,
        agents_run     = agents_run,
    )


# ── POST /loan/generate/{id} ──────────────────────────────
@router.post("/generate/{session_id}")
async def generate_offer_direct(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Called by VideoCallPage.jsx after endCall()."""
    session = await get_session_or_404(session_id, db)
    await run_pipeline(session_id, db)

    offer = session.offer_output or {}
    return {
        "status":        offer.get("status", "ineligible"),
        "amount":        offer.get("approved_amount"),
        "interest_rate": offer.get("interest_rate"),
        "tenure_months": offer.get("recommended_tenure"),
        "emi":           (offer.get("emi_options") or [{}])[0].get("emi"),
        "product_type":  offer.get("product_name"),
        "risk_score":    offer.get("risk_score"),
        "fraud_flag":    session.fraud_flag,
        "reason":        offer.get("reason"),
        "agent_statuses": {
            "speech":      "completed" if session.speech_output      else "pending",
            "deepface":    "completed" if session.deepface_output    else "pending",
            "transaction": "completed" if session.transaction_output else "pending",
            "geo":         "completed" if session.geo_output         else "pending",
            "fraud":       session.fraud_flag or "pending",
        }
    }


# ── GET /loan/{id}/summary ────────────────────────────────
@router.get("/{session_id}/summary")
async def loan_summary(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Compact summary for the result screen."""
    session = await get_session_or_404(session_id, db)
    offer   = session.offer_output or {}

    return {
        "success": True,
        "message": "Loan summary",
        "data": {
            "session_id":      str(session_id),
            "customer_name":   session.customer_name,
            "status":          session.status.value,
            "fraud_flag":      session.fraud_flag,
            "fraud_decision":  session.fraud_decision,
            "fraud_signals":   (session.fraud_output or {}).get("signals", []),
            "risk_score":      session.risk_score,
            "approved_amount": session.approved_amount,
            "interest_rate":   session.interest_rate,
            "product":         session.recommended_product,
            "consent_given":   session.consent_given,
            "offer_message":   offer.get("pre_approval_message"),
            "emi_options":     offer.get("emi_options", []),
            "processing_fee":  offer.get("processing_fee"),
            "risk_level":      (session.risk_output or {}).get("risk_level"),
            "face_match":      (session.deepface_output or {}).get("face_match"),
            "geo_distance_km": (session.geo_output or {}).get("distance_km"),
            "pdf_tampered":    (session.transaction_output or {}).get("pdf_tampered"),
        }
    }


# ── Helpers ───────────────────────────────────────────────

def _compute_reduction(risk_score: int) -> float:
    if risk_score >= 80: return 1.0
    if risk_score >= 50: return round(0.70 + (risk_score - 50) / 30 * 0.30, 2)
    return round(0.40 + risk_score / 50 * 0.30, 2)


def _build_offer_response(session_id: UUID, result: dict, session: LoanSession) -> LoanOfferResponse:
    if not result:
        return None
    emi_opts = [EMIOption(**o) for o in (result.get("emi_options") or [])]
    return LoanOfferResponse(
        session_id           = session_id,
        status               = result.get("status", "ineligible"),
        customer_name        = result.get("customer_name"),
        product_name         = result.get("product_name"),
        approved_amount      = result.get("approved_amount"),
        interest_rate        = result.get("interest_rate"),
        recommended_tenure   = result.get("recommended_tenure"),
        emi_options          = emi_opts,
        processing_fee       = result.get("processing_fee"),
        risk_score           = result.get("risk_score"),
        risk_level           = result.get("risk_level"),
        fraud_flag           = session.fraud_flag,
        fraud_signals        = (session.fraud_output or {}).get("signals", []),
        ineligibility_reason = result.get("reason"),
    )