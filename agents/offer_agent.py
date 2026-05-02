from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# CORS (frontend connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- INPUT SCHEMA ----------------

class LoanSchema(BaseModel):
    customer_name: Optional[str] = ""
    requested_amount: int
    loan_tenure_preference: Optional[int] = None


class PolicyProduct(BaseModel):
    key: str
    name: str
    min_amount: int
    max_amount: int
    max_tenure: int


class PolicyOutput(BaseModel):
    status: str
    max_eligible_amount: int
    recommended_product: str
    eligible_products: List[PolicyProduct]


class RiskOutput(BaseModel):
    risk_score: int
    risk_level: str
    reduction_factor: float
    action: str


class OfferRequest(BaseModel):
    loan_schema: LoanSchema
    policy_output: PolicyOutput
    risk_output: RiskOutput


# ---------------- CONSTANTS ----------------

RATE_BANDS = {
    "personal_loan": [(80,100,9.99),(65,79,11.5),(50,64,14),(0,49,16)],
    "business_loan": [(80,100,15),(65,79,18),(50,64,22),(0,49,28)]
}

PROCESSING_FEES = {
    "personal_loan": 3.0,
    "business_loan": 3.0
}

TENURE_OPTIONS = {
    "personal_loan": [12,24,36,48,60],
    "business_loan": [12,24,36]
}


# ---------------- EMI FUNCTION ----------------

def calculate_emi(P, rate, n):
    r = rate / 12 / 100
    emi = P * r * (1+r)**n / ((1+r)**n - 1) if r > 0 else P/n
    emi = round(emi)
    total = emi * n

    return {
        "tenure_months": n,
        "emi": emi,
        "total_interest": total - P,
        "total_payable": total
    }


# ---------------- MAIN API ----------------

@app.post("/generate-offer")
def generate_offer(data: OfferRequest):

    risk = data.risk_output
    policy = data.policy_output
    loan = data.loan_schema

    # ❌ Reject case
    if risk.action.lower().startswith("reject"):
        return {
            "status": "ineligible",
            "reason": "High risk applicant"
        }

    # ❌ Policy fail
    if policy.status == "ineligible":
        return {
            "status": "ineligible",
            "reason": "Policy rules failed"
        }

    # ---------------- PRODUCT ----------------
    product = next(
        (p for p in policy.eligible_products if p.key == policy.recommended_product),
        policy.eligible_products[0]
    )

    # ---------------- APPROVED AMOUNT ----------------
    approved = int(policy.max_eligible_amount * risk.reduction_factor)
    approved = min(approved, loan.requested_amount)
    approved = (approved // 10000) * 10000

    # ---------------- INTEREST RATE ----------------
    rate = 16
    for min_s, max_s, r in RATE_BANDS[product.key]:
        if min_s <= risk.risk_score <= max_s:
            rate = r
            break

    # ---------------- TENURE ----------------
    options = TENURE_OPTIONS[product.key]
    tenure = loan.loan_tenure_preference or options[len(options)//2]

    # ---------------- EMI OPTIONS ----------------
    emi_options = [calculate_emi(approved, rate, t) for t in options]

    # ---------------- PROCESSING FEE ----------------
    fee_pct = PROCESSING_FEES[product.key]
    fee = int(approved * fee_pct / 100)

    # ---------------- FINAL RESPONSE ----------------
    return {
        "agent": "offer_engine",
        "status": "offer_generated",
        "customer_name": loan.customer_name,
        "product_name": product.name,
        "approved_amount": approved,
        "interest_rate": rate,
        "recommended_tenure": tenure,
        "emi_options": emi_options,
        "processing_fee": fee,
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level
    }


# ---------------- RUN ----------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)