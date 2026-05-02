"""
POLICY AGENT
------------
Responsibilities:
  1. Apply Poonawalla Fincorp's real lending rules to the extracted loan schema
  2. Check hard eligibility: age, income, DTI/FOIR, employment, business vintage
  3. Determine which loan products the customer qualifies for (all 13+ products)
  4. Calculate maximum eligible loan amount based on income and obligations
  5. Save result to policy_output.json

Rules sourced from: poonawallafincorp.com (as documented in system knowledge base)

Output (policy_output.json):
{
  "agent": "policy",
  "status": "eligible" | "ineligible",
  "eligible_products": [...],
  "failed_rules": [...],
  "passed_rules": [...],
  "max_eligible_amount": 2000000,
  "recommended_product": "personal_loan",
  "monthly_income_used": 45000,
  "dti_ratio_used": 0.22
}
"""

import json
import os
from dotenv import load_dotenv

load_dotenv()

# ── Poonawalla Fincorp Lending Policy Rules ───────────────
# Source: poonawallafincorp.com official product guidelines
POLICY_RULES = {
    # Personal Loan
    "personal_min_age":               21,
    "personal_max_age":               60,
    "instant_loan_min_age":           25,
    "instant_loan_max_age":           55,
    "personal_min_monthly_income":    20000,   # ₹20,000/month net
    "personal_loan_min":              100000,  # ₹1 lakh
    "personal_loan_max":              5000000, # ₹50 lakhs
    "instant_loan_min":               50000,   # ₹50K
    "instant_loan_max":               500000,  # ₹5 lakhs
    "personal_min_work_exp_months":   12,      # 1 year total
    "personal_cibil_recommended":     750,

    # Business Loan
    "business_min_age":               24,
    "business_max_age":               65,
    "business_loan_min":              100000,  # ₹1 lakh
    "business_loan_max":              5000000, # ₹50 lakhs
    "business_min_vintage_months":    24,      # 2 years operation
    "business_min_annual_turnover":   600000,  # ₹6 lakhs
    "business_cibil_min":             650,

    # Professional Loan
    "professional_min_age":           23,
    "professional_max_age":           65,
    "professional_loan_min":          100000,
    "professional_loan_max":          7500000, # ₹75 lakhs

    # Gold Loan
    "gold_loan_min_age":              21,
    "gold_loan_max_age":              65,
    "gold_loan_max":                  5000000, # ₹50 lakhs

    # Loan Against Property (LAP)
    "lap_min":                        6000000, # ₹60 lakhs
    "lap_max":                        50000000,# ₹5 crores
    "lap_min_monthly_income":         40000,

    # General
    "max_foir":                       0.55,    # max 55% of income to EMIs
    "max_dti":                        0.55,
}

# Full product catalogue
LOAN_PRODUCTS = {
    "personal_loan": {
        "name":        "Personal Loan",
        "min_amount":  POLICY_RULES["personal_loan_min"],
        "max_amount":  POLICY_RULES["personal_loan_max"],
        "min_income":  POLICY_RULES["personal_min_monthly_income"],
        "min_age":     POLICY_RULES["personal_min_age"],
        "max_age":     POLICY_RULES["personal_max_age"],
        "base_rate":   9.99,
        "max_tenure":  84,
        "purposes":    ["personal", "medical", "education", "travel", "wedding",
                        "home renovation", "debt consolidation", None],
        "employment":  ["salaried", "self-employed", "professional"],
        "cibil_min":   POLICY_RULES["personal_cibil_recommended"],
        "notes":       "Unsecured. No collateral. 100% digital.",
    },
    "instant_loan": {
        "name":        "Instant Personal Loan",
        "min_amount":  POLICY_RULES["instant_loan_min"],
        "max_amount":  POLICY_RULES["instant_loan_max"],
        "min_income":  POLICY_RULES["personal_min_monthly_income"],
        "min_age":     POLICY_RULES["instant_loan_min_age"],
        "max_age":     POLICY_RULES["instant_loan_max_age"],
        "base_rate":   16.0,
        "max_tenure":  36,
        "purposes":    ["personal", "medical", "urgent", None],
        "employment":  ["salaried"],
        "cibil_min":   POLICY_RULES["personal_cibil_recommended"],
        "notes":       "PAN + Aadhaar only. Very fast disbursal.",
    },
    "business_loan": {
        "name":        "Business Loan",
        "min_amount":  POLICY_RULES["business_loan_min"],
        "max_amount":  POLICY_RULES["business_loan_max"],
        "min_income":  0,   # turnover-based
        "min_age":     POLICY_RULES["business_min_age"],
        "max_age":     POLICY_RULES["business_max_age"],
        "base_rate":   15.0,
        "max_tenure":  36,
        "purposes":    ["business", "working capital", "business expansion",
                        "inventory", "msme"],
        "employment":  ["business-owner", "self-employed"],
        "cibil_min":   POLICY_RULES["business_cibil_min"],
        "notes":       "Requires 24+ months business vintage and ₹6L+ annual turnover.",
    },
    "professional_loan": {
        "name":        "Professional Loan",
        "min_amount":  POLICY_RULES["professional_loan_min"],
        "max_amount":  POLICY_RULES["professional_loan_max"],
        "min_income":  0,
        "min_age":     POLICY_RULES["professional_min_age"],
        "max_age":     POLICY_RULES["professional_max_age"],
        "base_rate":   13.0,
        "max_tenure":  60,
        "purposes":    ["personal", "professional", "clinic", "equipment",
                        "office", "education", "medical", None],
        "employment":  ["professional"],
        "cibil_min":   700,
        "notes":       "For CA, CS, Doctors, Lawyers, Architects. Certificate of Practice required.",
    },
    "gold_loan": {
        "name":        "Gold Loan",
        "min_amount":  10000,
        "max_amount":  POLICY_RULES["gold_loan_max"],
        "min_income":  0,   # secured — no income minimum
        "min_age":     POLICY_RULES["gold_loan_min_age"],
        "max_age":     POLICY_RULES["gold_loan_max_age"],
        "base_rate":   11.0,
        "max_tenure":  24,
        "purposes":    None,   # any purpose
        "employment":  None,   # any employment
        "cibil_min":   0,      # secured — credit score not critical
        "notes":       "Requires gold jewellery 18–22 karat. LTV up to 75% of gold value.",
        "requires_gold": True,
    },
    "loan_against_property": {
        "name":        "Loan Against Property",
        "min_amount":  POLICY_RULES["lap_min"],
        "max_amount":  POLICY_RULES["lap_max"],
        "min_income":  POLICY_RULES["lap_min_monthly_income"],
        "min_age":     21,
        "max_age":     65,
        "base_rate":   10.5,
        "max_tenure":  240,
        "purposes":    None,
        "employment":  None,
        "cibil_min":   650,
        "notes":       "Requires owned property. Up to ₹5 Crore. Up to 20 years tenure.",
        "requires_property": True,
    },
    "education_loan": {
        "name":        "Education Loan",
        "min_amount":  50000,
        "max_amount":  5000000,
        "min_income":  0,
        "min_age":     18,
        "max_age":     35,
        "base_rate":   10.0,
        "max_tenure":  120,
        "purposes":    ["education"],
        "employment":  None,
        "cibil_min":   0,
        "notes":       "Moratorium period available. Domestic and international.",
    },
}

# Professional employment types that qualify for Professional Loan
PROFESSIONAL_TYPES = {"ca", "chartered accountant", "cs", "company secretary",
                      "doctor", "lawyer", "advocate", "architect", "professional"}


class PolicyAgent:
    def __init__(self, loan_schema: dict, deepface_output: dict, transaction_output: dict):
        self.schema      = loan_schema
        self.deepface    = deepface_output
        self.transaction = transaction_output

    def _get_monthly_income(self) -> int:
        return int(
            self.transaction.get("monthly_income") or
            self.schema.get("monthly_income") or 0
        )

    def _get_dti(self) -> float:
        return float(
            self.transaction.get("dti_ratio") or
            self.transaction.get("foir") or 0.0
        )

    def _get_age(self):
        return self.deepface.get("estimated_age")

    def _get_cibil(self):
        return self.schema.get("credit_score_self_reported")

    # ── Rule checking ─────────────────────────────────────

    def check_rules(self) -> tuple:
        passed = []
        failed = []

        age             = self._get_age()
        monthly_income  = self._get_monthly_income()
        dti             = self._get_dti()
        cibil           = self._get_cibil()
        req_amount      = self.schema.get("requested_amount") or 0
        employment_type = (self.schema.get("employment_type") or "unknown").lower()
        face_match      = self.deepface.get("face_match", False)

        # Face verification — hard requirement
        if face_match:
            passed.append("Face verification passed — identity confirmed")
        else:
            failed.append("Face verification failed — identity not confirmed (hard block)")

        # Age check (personal loan range is strictest baseline)
        if age is not None:
            if POLICY_RULES["personal_min_age"] <= age <= POLICY_RULES["personal_max_age"]:
                passed.append(f"Age {age} is within personal loan eligible range (21–60)")
            elif POLICY_RULES["business_min_age"] <= age <= POLICY_RULES["business_max_age"]:
                passed.append(f"Age {age} is within business/professional loan range (24–65)")
            else:
                failed.append(f"Age {age} is outside all eligible ranges — ineligible for unsecured loans")
        else:
            passed.append("Age not estimated — will apply product-level checks")

        # Income check
        if monthly_income >= POLICY_RULES["personal_min_monthly_income"]:
            passed.append(f"Monthly income ₹{monthly_income:,} meets personal loan minimum ₹{POLICY_RULES['personal_min_monthly_income']:,}")
        else:
            failed.append(f"Monthly income ₹{monthly_income:,} is below personal loan minimum ₹{POLICY_RULES['personal_min_monthly_income']:,}")

        # FOIR/DTI check
        if dti <= POLICY_RULES["max_foir"]:
            passed.append(f"FOIR {dti:.0%} is within allowed limit ({POLICY_RULES['max_foir']:.0%})")
        else:
            failed.append(f"FOIR {dti:.0%} exceeds maximum allowed ({POLICY_RULES['max_foir']:.0%})")

        # Business vintage check
        if employment_type in ("business-owner", "self-employed"):
            vintage = self.schema.get("business_vintage_months")
            if vintage is not None:
                if vintage >= POLICY_RULES["business_min_vintage_months"]:
                    passed.append(f"Business vintage {vintage} months meets minimum 24 months")
                else:
                    failed.append(f"Business vintage {vintage} months is below required 24 months")

            turnover = self.schema.get("annual_turnover")
            if turnover is not None:
                if turnover >= POLICY_RULES["business_min_annual_turnover"]:
                    passed.append(f"Annual turnover ₹{turnover:,} meets minimum ₹6,00,000")
                else:
                    failed.append(f"Annual turnover ₹{turnover:,} is below required ₹6,00,000")

        # CIBIL check
        if cibil is not None:
            if cibil >= POLICY_RULES["personal_cibil_recommended"]:
                passed.append(f"CIBIL score {cibil} meets personal loan recommended threshold (750+)")
            elif cibil >= POLICY_RULES["business_cibil_min"]:
                passed.append(f"CIBIL score {cibil} meets business/professional loan threshold (650+)")
            else:
                failed.append(f"CIBIL score {cibil} is below minimum threshold (650)")

        return passed, failed

    # ── Product eligibility ───────────────────────────────

    def determine_eligible_products(self) -> list:
        """Returns list of all products the customer qualifies for."""
        eligible       = []
        monthly_income = self._get_monthly_income()
        age            = self._get_age()
        cibil          = self._get_cibil()
        employment     = (self.schema.get("employment_type") or "unknown").lower()
        purpose        = (self.schema.get("loan_purpose") or "").lower()
        req_amount     = self.schema.get("requested_amount") or 0
        has_gold       = self.schema.get("has_gold_assets", False)
        owns_property  = self.schema.get("owns_property", False)
        vintage        = self.schema.get("business_vintage_months")
        turnover       = self.schema.get("annual_turnover")

        for product_key, product in LOAN_PRODUCTS.items():
            reasons_blocked = []

            # Gold loan: only if has gold
            if product.get("requires_gold") and not has_gold:
                continue

            # LAP: only if owns property
            if product.get("requires_property") and not owns_property:
                continue

            # Income check (skip for gold loan and LAP if secured)
            if product["min_income"] > 0 and monthly_income < product["min_income"]:
                reasons_blocked.append(f"income ₹{monthly_income:,} < ₹{product['min_income']:,}")

            # Age check
            if age is not None:
                if age < product["min_age"] or age > product["max_age"]:
                    reasons_blocked.append(f"age {age} outside {product['min_age']}–{product['max_age']}")

            # Employment check
            if product.get("employment") and employment not in product["employment"]:
                if product_key == "professional_loan":
                    employer_name = (self.schema.get("employer_name") or "").lower()
                    if not any(pt in employer_name or pt == employment for pt in PROFESSIONAL_TYPES):
                        reasons_blocked.append(f"employment '{employment}' not eligible for professional loan")
                else:
                    reasons_blocked.append(f"employment '{employment}' not eligible")

            # Purpose check — only if specified and product has purpose restriction
            if purpose and product.get("purposes") is not None:
                if not any(p and p in purpose for p in product["purposes"]):
                    reasons_blocked.append(f"purpose '{purpose}' not matched")

            # Amount range check — only if requested amount specified
            if req_amount > 0:
                if req_amount < product["min_amount"]:
                    reasons_blocked.append(f"requested ₹{req_amount:,} < product minimum ₹{product['min_amount']:,}")
                if req_amount > product["max_amount"]:
                    reasons_blocked.append(f"requested ₹{req_amount:,} > product maximum ₹{product['max_amount']:,}")

            # Business loan specific checks
            if product_key == "business_loan":
                if vintage is not None and vintage < POLICY_RULES["business_min_vintage_months"]:
                    reasons_blocked.append(f"business vintage {vintage}mo < required 24mo")
                if turnover is not None and turnover < POLICY_RULES["business_min_annual_turnover"]:
                    reasons_blocked.append(f"annual turnover ₹{turnover:,} < required ₹6,00,000")

            # CIBIL check
            if cibil is not None and product["cibil_min"] > 0 and cibil < product["cibil_min"]:
                reasons_blocked.append(f"CIBIL {cibil} < required {product['cibil_min']}")

            if not reasons_blocked:
                eligible.append({
                    "product":     product["name"],
                    "key":         product_key,
                    "base_rate":   product["base_rate"],
                    "min_amount":  product["min_amount"],
                    "max_amount":  product["max_amount"],
                    "max_tenure":  product["max_tenure"],
                    "notes":       product.get("notes", ""),
                })

        return eligible

    # ── Max eligible amount ───────────────────────────────

    def calculate_max_eligible_amount(self) -> int:
        """
        Max loan = (disposable monthly income) × affordability multiplier
        Poonawalla rule: existing obligations ≤ 55% of income
        Available for new EMI = income × (1 - current_dti) - existing_emis
        Multiplier ~40x monthly EMI for a 3-year personal loan at 12%
        """
        monthly_income  = self._get_monthly_income()
        dti             = self._get_dti()
        existing_emis   = self.schema.get("existing_emis") or 0

        available_for_emi = (monthly_income * (1 - dti)) - existing_emis
        available_for_emi = max(0.0, available_for_emi)

        # Cap: FOIR after new EMI should not exceed 55%
        max_allowed_new_emi = (monthly_income * POLICY_RULES["max_foir"]) - existing_emis
        max_allowed_new_emi = max(0.0, max_allowed_new_emi)

        effective_emi = min(available_for_emi, max_allowed_new_emi)
        max_amount    = int(effective_emi * 40)  # ~40x rule
        return max_amount

    # ── Recommend best product ────────────────────────────

    def recommend_product(self, eligible_products: list) -> str | None:
        """Returns the single best product key for the customer's profile."""
        if not eligible_products:
            return None
        purpose = (self.schema.get("loan_purpose") or "").lower()
        # Purpose-to-product priority mapping
        priority_map = {
            "education":         "education_loan",
            "business":          "business_loan",
            "working capital":   "business_loan",
            "home purchase":     "personal_loan",
            "home renovation":   "personal_loan",
            "personal":          "personal_loan",
            "medical":           "personal_loan",
        }
        preferred_key = priority_map.get(purpose)
        eligible_keys = {p["key"] for p in eligible_products}

        if preferred_key and preferred_key in eligible_keys:
            return preferred_key
        # Default: personal loan, then instant, then business
        for key in ["personal_loan", "instant_loan", "business_loan", "professional_loan",
                    "gold_loan", "loan_against_property", "education_loan"]:
            if key in eligible_keys:
                return key
        return eligible_products[0]["key"]

    # ── Main ──────────────────────────────────────────────

    def run(self) -> dict:
        print("📋 Policy Agent checking Poonawalla Fincorp lending rules...")

        monthly_income    = self._get_monthly_income()
        dti               = self._get_dti()

        passed_rules, failed_rules = self.check_rules()
        eligible_products          = self.determine_eligible_products()
        max_eligible_amount        = self.calculate_max_eligible_amount()
        recommended_product        = self.recommend_product(eligible_products)

        # Ineligible if face match failed or no products qualify
        hard_fails = [r for r in failed_rules if "Face verification" in r or "outside all eligible" in r]
        status     = "ineligible" if hard_fails or not eligible_products else "eligible"

        output = {
            "agent":                "policy",
            "status":               status,
            "eligible_products":    eligible_products,
            "recommended_product":  recommended_product,
            "passed_rules":         passed_rules,
            "failed_rules":         failed_rules,
            "max_eligible_amount":  max_eligible_amount,
            "monthly_income_used":  monthly_income,
            "dti_ratio_used":       dti,
            "requested_amount":     self.schema.get("requested_amount"),
        }

        print(f"   Status: {status.upper()} | Eligible products: {len(eligible_products)}")
        if eligible_products:
            print(f"   Recommended: {recommended_product} | Max eligible: ₹{max_eligible_amount:,}")
        if failed_rules:
            print(f"   Failed rules: {'; '.join(failed_rules[:2])}")
        return output


if __name__ == "__main__":
    def load(path):
        with open(path) as f:
            return json.load(f)

    extractor   = load("extractor_output.json")
    deepface    = load("deepface_output.json")
    transaction = load("transaction_output.json")

    agent = PolicyAgent(
        loan_schema        = extractor["loan_schema"],
        deepface_output    = deepface,
        transaction_output = transaction,
    )
    agent.run()