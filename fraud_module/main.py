from transaction_agent.pdf_tamper_detector import detect_pdf_tampering
from transaction_agent.statement_parser import parse_bank_statement
from transaction_agent.feature_engineer import engineer_features
from transaction_agent.xgboost_scorer import score_fraud
from fraud_detector.fraud_detector_agent import fraud_detector_agent

def run_test(pdf_path, stated_income, loan_type, applicant_id, test_name, password=None):
    print("=" * 50)
    print(f"TEST — {test_name}")
    print("=" * 50)

    # Step 1 - Tampering
    print("🔍 Checking PDF tampering...")
    tamper = detect_pdf_tampering(pdf_path)
    print(tamper)

    # Step 2 - Parse
    print("\n📄 Parsing transactions...")
    df = parse_bank_statement(pdf_path, password=password)  # ← pass password here
    print(f"Extracted {len(df)} transactions")

    if len(df) == 0:
        print("⚠️ Could not parse transactions from this PDF")
        print("Possible reasons: scanned PDF, unsupported format, wrong password")
        print("\n")
        return

    # Step 3 - Features
    print("\n⚙️ Engineering features...")
    features = engineer_features(df, stated_income, loan_type)
    print(features)

    # Step 4 - XGBoost
    print("\n🤖 Scoring fraud...")
    xgb_result = score_fraud(features)
    print(xgb_result)

    # Step 5 - Fraud Detector
    print("\n🚨 Running Fraud Detector Agent...")
    result = fraud_detector_agent(
        pan_result={"valid": True},
        aadhaar_result={"valid": True},
        photo_result={"fraud_signal": False},
        face_match_score=0.91,
        tampering_result=tamper,
        features=features,
        xgboost_result=xgb_result,
        conversation_result={"fraud_signals": []},
        applicant_id=applicant_id
    )

    print(f"\n✅ FINAL DECISION: {result['flag']}")
    print(f"Action:           {result['action']}")
    print(f"Total Weight:     {result['total_weight']}")
    print(f"Signals Raised:   {result['signal_count']}")
    if result['signals']:
        print("\n⚠️  Signals Detected:")
        for s in result['signals']:
            print(f"   - [{s['source']}] {s['detail']} (weight: {s['weight']})")
    print("\n")


# --- RUN BOTH TESTS ---

run_test(
    pdf_path="sample_statement.pdf",
    stated_income=50000,
    loan_type="personal_loan_salaried",
    applicant_id="TEST_001",
    test_name="LEGITIMATE APPLICANT"
)

run_test(
    pdf_path="fraud_statement.pdf",
    stated_income=80000,
    loan_type="personal_loan_salaried",
    applicant_id="TEST_002",
    test_name="FRAUDULENT APPLICANT"
)

run_test(
    pdf_path="icici_statement.pdf",  # original locked version
    stated_income=50000,
    loan_type="personal_loan_salaried",
    applicant_id="TEST_003",
    test_name="ICICI REAL STATEMENT",
    password="aliz0701"  # pass password directly here
)