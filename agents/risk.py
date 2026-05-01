from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- INPUT SCHEMA ----------------

class LoanSchema(BaseModel):
    credit_score_self_reported: int
    employment_type: str
    employer_category: str
    employer_name: str
    monthly_income: int
    requested_amount: int


class DeepFaceOutput(BaseModel):
    estimated_age: int
    face_match: bool


class TransactionOutput(BaseModel):
    monthly_income: int
    bounce_count: int
    risk_flags: List[str]


class FraudOutput(BaseModel):
    weighted_score: float
    conv_risk_level: str
    flags: List[str]


class PolicyOutput(BaseModel):
    pass


class RiskRequest(BaseModel):
    loan_schema: LoanSchema
    deepface_output: DeepFaceOutput
    transaction_output: TransactionOutput
    fraud_output: FraudOutput
    policy_output: Optional[PolicyOutput] = None


# ---------------- SCORING ENGINE ----------------

def calculate_risk(data: RiskRequest):

    score = 0
    breakdown = {}

    loan = data.loan_schema
    face = data.deepface_output
    txn = data.transaction_output
    fraud = data.fraud_output

    # -------- CREDIT SCORE --------
    if loan.credit_score_self_reported >= 750:
        score += 30
        breakdown["credit"] = "+30 (≥750 excellent)"
    elif loan.credit_score_self_reported >= 650:
        score += 10
        breakdown["credit"] = "+10 (650–749 average)"
    else:
        score -= 30
        breakdown["credit"] = "-30 (<650 risky)"

    # -------- EMPLOYMENT --------
    if loan.employer_category.lower() in ["govt", "mnc", "psu"]:
        score += 20
        breakdown["employment"] = "+20 stable"
    else:
        score -= 20
        breakdown["employment"] = "-20 unstable"

    # -------- INCOME VS LOAN (FIXED) --------
    ratio = loan.requested_amount / max(loan.monthly_income, 1)

    if ratio <= 3:
        score += 20
        breakdown["income"] = "+20 high affordability"
    elif ratio <= 5:
        score += 10
        breakdown["income"] = "+10 moderate affordability"
    else:
        score -= 20
        breakdown["income"] = "-20 low affordability"

    # -------- REPAYMENT (FIXED) --------
    if txn.bounce_count == 0:
        score += 20
        breakdown["repayment"] = "+20 clean history"
    elif txn.bounce_count == 1:
        score -= 5
        breakdown["repayment"] = "-5 minor issue"
    else:
        score -= 30
        breakdown["repayment"] = "-30 defaults/bounces"

    # -------- AGE --------
    if 25 <= face.estimated_age <= 50:
        score += 10
        breakdown["age"] = "+10 prime age"
    elif 21 <= face.estimated_age <= 60:
        score += 0
        breakdown["age"] = "0 acceptable age"
    else:
        score -= 10
        breakdown["age"] = "-10 edge age"

    # -------- DATA CONSISTENCY (IMPROVED) --------
    mismatch = False

    if not face.face_match:
        mismatch = True

    if fraud.weighted_score > 0.5:
        mismatch = True

    if any("mismatch" in f.lower() or "fraud" in f.lower() for f in fraud.flags):
        mismatch = True

    if txn.bounce_count > 2:
        mismatch = True

    if mismatch:
        score -= 20
        breakdown["consistency"] = "-20 mismatch detected"
    else:
        score += 10
        breakdown["consistency"] = "+10 all data consistent"

    # -------- NORMALIZATION (CORRECT) --------
    normalized_score = int(((score + 100) / 210) * 100)
    normalized_score = max(0, min(100, normalized_score))

    # -------- FINAL CLASSIFICATION --------
    if normalized_score >= 80:
        level = "LOW RISK"
        action = "FAST TRACK APPROVAL"
    elif normalized_score >= 50:
        level = "MEDIUM RISK"
        action = "VERIFICATION REQUIRED"
    else:
        level = "HIGH RISK"
        action = "REJECT"

    return {
        "risk_score": normalized_score,
        "risk_level": level,
        "action": action,
        "breakdown": breakdown,
        "raw_score": score
    }
# ---------------- API ----------------

@app.post("/risk-score")
def risk_score(request: RiskRequest):

    result = calculate_risk(request)

    print("\n================ RISK REPORT ================")
    print(result)

    return {
        "agent": "risk_scorer",
        "status": "completed",
        **result
    }


# ---------------- RUN ----------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)