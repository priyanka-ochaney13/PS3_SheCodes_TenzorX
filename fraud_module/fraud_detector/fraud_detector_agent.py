from datetime import datetime

def fraud_detector_agent(
    pan_result,
    aadhaar_result,
    photo_result,
    face_match_score,
    tampering_result,
    features,
    xgboost_result,
    conversation_result,
    applicant_id
):
    all_signals = []

    # Teammate 1 inputs
    if not pan_result.get("valid"):
        all_signals.append({"source": "PAN",
                            "detail": pan_result.get("reason","PAN invalid"),
                            "weight": 2})
    if not aadhaar_result.get("valid"):
        all_signals.append({"source": "AADHAAR",
                            "detail": aadhaar_result.get("reason","Aadhaar invalid"),
                            "weight": 2})
    if photo_result.get("fraud_signal"):
        all_signals.append({"source": "AI_PHOTO",
                            "detail": "AI generated photo detected",
                            "weight": 3})
    if face_match_score < 0.7:
        all_signals.append({"source": "FACE_MATCH",
                            "detail": f"Low confidence: {face_match_score:.2f}",
                            "weight": 3})

    # Your Transaction Agent inputs
    for sig in tampering_result.get("signals", []):
        all_signals.append({"source": "PDF_TAMPERING", **sig})

    if not features.get("period_sufficient"):
        all_signals.append({"source": "STATEMENT_PERIOD",
                            "detail": "Statement too short",
                            "weight": 1})
    if features.get("stated_vs_actual_gap_pct", 0) > 0.2:
        all_signals.append({"source": "INCOME_MISMATCH",
                            "detail": f"Gap: {features['stated_vs_actual_gap_pct']*100:.1f}%",
                            "weight": 2})
    if features.get("circular_transaction_flag"):
        all_signals.append({"source": "CIRCULAR_TXN",
                            "detail": "Circular transaction detected",
                            "weight": 3})
    if features.get("window_dressing_flag"):
        all_signals.append({"source": "WINDOW_DRESSING",
                            "detail": "Balance artificially inflated",
                            "weight": 2})

    # ✅ NEW — Bounce signal
    if features.get("bounce_count", 0) >= 1:
        all_signals.append({
            "source": "BOUNCE_DETECTED",
            "detail": f"{features['bounce_count']} ECS/cheque bounce(s) found",
            "weight": 2 if features["bounce_count"] >= 2 else 1
        })

    if xgboost_result.get("fraud_signal"):
        all_signals.append({"source": "XGBOOST",
                            "detail": f"Fraud prob: {xgboost_result['fraud_probability']:.2f}",
                            "weight": xgboost_result["weight"]})

    # Teammate 2 DeepSeek R1 inputs
    for sig in conversation_result.get("fraud_signals", []):
        all_signals.append({"source": "CONVERSATION", **sig})

    total_weight = sum(s["weight"] for s in all_signals)

    if total_weight <= 2:
        flag, action, halt = "GREEN", "PROCEED_TO_CREDIT_DECISION", False
    elif total_weight <= 5:
        flag, action, halt = "YELLOW", "PROCEED_WITH_CAUTION", False
    elif total_weight <= 9:
        flag, action, halt = "ORANGE", "ADDITIONAL_VERIFICATION", False
    else:
        flag, action, halt = "RED", "HARD_HALT", True

    return {
        "applicant_id": applicant_id,
        "flag": flag,
        "total_weight": total_weight,
        "signal_count": len(all_signals),
        "action": action,
        "halt_pipeline": halt,
        "signals": all_signals,
        "timestamp": datetime.utcnow().isoformat()
    }