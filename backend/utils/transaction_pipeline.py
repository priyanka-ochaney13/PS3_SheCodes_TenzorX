# utils/transaction_pipeline.py
"""
Transaction Pipeline
--------------------
Wires together the 4 transaction sub-modules your team wrote:
  1. pdf_tamper_detector  → detect if PDF was edited
  2. statement_parser     → parse transactions from PDF into a DataFrame
  3. feature_engineer     → extract fraud features from the DataFrame
  4. xgboost_scorer       → score fraud probability using trained model

Returns a single dict that becomes the transaction_output stored in the DB.
This dict is then read by the fraud_detector_agent.
"""

import os
import sys

# Make sure agents folder is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agents"))

from pdf_tamper_detector import detect_pdf_tampering
from statement_parser    import parse_bank_statement
from feature_engineer    import engineer_features
from xgboost_scorer      import score_fraud


def run_transaction_pipeline(
    pdf_path:      str,
    stated_income: float,
    loan_type:     str = "personal_loan_salaried",
    pdf_password:  str = None,
) -> dict:
    """
    Runs the full transaction analysis pipeline.
    Called by the /agents/transaction/{id} endpoint.

    Returns a dict with keys that both the fraud_detector_agent
    and risk_agent expect.
    """

    # ── Step 1: PDF tamper detection ──────────────────────
    print("🔍 Running PDF tamper detection...")
    try:
        tampering_result = detect_pdf_tampering(pdf_path)
    except Exception as e:
        print(f"⚠️  Tamper detection error: {e}")
        tampering_result = {"tampered": False, "signals": [], "total_weight": 0}

    # ── Step 2: Parse bank statement ──────────────────────
    print("📄 Parsing bank statement...")
    try:
        df = parse_bank_statement(pdf_path, password=pdf_password)
    except Exception as e:
        print(f"⚠️  Statement parse error: {e}")
        import pandas as pd
        df = pd.DataFrame()

    # ── Step 3: Feature engineering ───────────────────────
    print("⚙️  Engineering features...")
    try:
        features = engineer_features(df, stated_income or 0, loan_type)
    except Exception as e:
        print(f"⚠️  Feature engineering error: {e}")
        features = {
            "avg_monthly_credit":       0,
            "credit_consistency_score": 0,
            "stated_vs_actual_gap_pct": 1.0,
            "foir_existing":            1.0,
            "circular_transaction_flag":0,
            "window_dressing_flag":     0,
            "bounce_count":             0,
            "statement_period_months":  0,
            "period_sufficient":        False,
        }

    # ── Step 4: XGBoost fraud score ───────────────────────
    print("🤖 Running XGBoost fraud scorer...")
    try:
        xgboost_result = score_fraud(features)
    except Exception as e:
        print(f"⚠️  XGBoost error (model may not be trained yet): {e}")
        xgboost_result = {"fraud_probability": 0.0, "fraud_signal": False, "weight": 0}

    # ── Compose output ────────────────────────────────────
    output = {
        "agent":  "transaction",
        "status": "completed",

        # Raw features (used by fraud_detector_agent and risk_agent)
        "avg_monthly_credit":        features["avg_monthly_credit"],
        "monthly_income":            int(features["avg_monthly_credit"]),
        "credit_consistency_score":  features["credit_consistency_score"],
        "stated_vs_actual_gap_pct":  features["stated_vs_actual_gap_pct"],
        "foir_existing":             features["foir_existing"],
        "circular_transaction_flag": bool(features["circular_transaction_flag"]),
        "window_dressing_flag":      bool(features["window_dressing_flag"]),
        "bounce_count":              features["bounce_count"],
        "statement_period_months":   features["statement_period_months"],
        "period_sufficient":         features["period_sufficient"],

        # Tamper check (used by fraud_detector_agent)
        "pdf_tampered":    tampering_result["tampered"],
        "tamper_signals":  tampering_result["signals"],
        "tamper_weight":   tampering_result["total_weight"],
        "tampering_result":tampering_result,  # full dict for fraud agent

        # XGBoost result (used by fraud_detector_agent)
        "xgboost_result":  xgboost_result,
        "fraud_probability": xgboost_result["fraud_probability"],

        # For risk_agent compatibility
        "risk_flags":  _build_risk_flags(features, tampering_result),
    }

    print(f"✅ Transaction pipeline done — income: ₹{output['monthly_income']:,} | "
          f"fraud_prob: {xgboost_result['fraud_probability']:.2f} | "
          f"tampered: {tampering_result['tampered']}")
    return output


def _build_risk_flags(features: dict, tampering: dict) -> list:
    """Build human-readable risk flag strings for the risk_agent."""
    flags = []
    if tampering.get("tampered"):
        flags.append("PDF_TAMPERED")
    if features.get("circular_transaction_flag"):
        flags.append("CIRCULAR_TRANSACTION")
    if features.get("window_dressing_flag"):
        flags.append("WINDOW_DRESSING")
    if features.get("bounce_count", 0) >= 2:
        flags.append(f"HIGH_BOUNCE_COUNT_{features['bounce_count']}")
    if features.get("stated_vs_actual_gap_pct", 0) > 0.2:
        flags.append("INCOME_MISMATCH")
    if not features.get("period_sufficient"):
        flags.append("STATEMENT_PERIOD_TOO_SHORT")
    if features.get("foir_existing", 0) > 0.65:
        flags.append("HIGH_FOIR")
    return flags
