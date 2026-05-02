"""
EXTRACTOR AGENT
---------------
Responsibilities:
  1. Take the full conversation transcript from the speech agent
  2. Take verified financial data from the transaction agent
  3. Use Groq LLaMA (llama-3.3-70b-versatile) to extract a structured loan application schema

Uses Groq API (free) instead of Anthropic — same prompt, same output.
"""

import os
import re
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are a loan application data extractor for an Indian fintech company (Poonawalla Fincorp).
You will receive a conversation transcript between a loan onboarding agent and a customer,
along with verified financial data from the customer's bank statement analysis.

Your job is to extract a complete structured loan application schema from this information.

Respond ONLY with a valid JSON object. No markdown, no explanation, nothing else.

JSON format:
{
  "customer_name": <full name mentioned by customer, or null>,
  "date_of_birth": <DOB mentioned in DD/MM/YYYY format, or null>,
  "loan_purpose": <purpose stated, one of: "home purchase", "home renovation", "business", "working capital", "personal", "education", "medical", "vehicle", "gold loan", or null>,
  "requested_amount": <amount in INR as integer, or null if not mentioned>,
  "monthly_income": <verified monthly income from bank statement as integer, or stated income if no bank data>,
  "existing_emis": <total existing EMI amount per month in INR as integer, 0 if none mentioned>,
  "employment_type": <"salaried", "self-employed", "business-owner", "professional", or "unknown">,
  "employer_name": <employer or company name mentioned, or null>,
  "employer_category": <"govt", "psu", "mnc", "pvt-ltd", "llp", "proprietorship", "other", or null>,
  "loan_tenure_preference": <preferred tenure in months as integer, or null if not mentioned>,
  "city": <city of residence mentioned or inferred from Aadhaar address, or null>,
  "credit_score_self_reported": <CIBIL/credit score mentioned by customer as integer, or null>,
  "has_gold_assets": <true if customer mentioned owning gold jewellery, false otherwise>,
  "owns_property": <true if customer mentioned owning property, false otherwise>,
  "business_vintage_months": <months of business operation if self-employed/business owner, or null>,
  "annual_turnover": <annual business turnover in INR as integer if mentioned, or null>,
  "consent_given": <true if customer explicitly gave consent for recording and data processing, false otherwise>,
  "applied_elsewhere_recently": <true if customer mentioned applying for loans at other institutions in last 30 days, false otherwise>,
  "additional_notes": <any other relevant details from the conversation as a string, or null>
}

Rules:
- Prefer verified bank statement data over customer-stated income for the monthly_income field
- If customer states income AND bank data exists, use bank data
- Convert all amounts to INR integers (e.g. "5 lakhs" = 500000, "50 thousand" = 50000, "1 crore" = 10000000)
- "10 lakh" = 1000000, "1.5 lakh" = 150000
- employment_type "professional" = CA, doctor, lawyer, architect, CS
- If a field cannot be determined from the conversation, use null (not "unknown" or empty string)
- For has_gold_assets and owns_property, default to false if not mentioned
- For consent_given, only set true if the customer explicitly said yes/I consent/I agree"""


class ExtractorAgent:
    def __init__(self, transcript_output: dict, transaction_output: dict):
        self.transcript  = transcript_output
        self.transaction = transaction_output
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def build_prompt(self) -> str:
        full_transcript = self.transcript.get("full_transcript", "No transcript available.")

        # ── Sanitize every field — never let None reach an f-string formatter ──
        monthly_income = self.transaction.get("monthly_income")
        try:
            monthly_income = int(monthly_income) if monthly_income is not None else 0
        except (ValueError, TypeError):
            monthly_income = 0

        avg_balance   = self.transaction.get("average_monthly_balance") or "Unknown"
        dti_ratio     = self.transaction.get("dti_ratio") or "Unknown"
        foir          = self.transaction.get("foir") or "Unknown"
        risk_level    = self.transaction.get("risk_level") or "Unknown"
        risk_flags    = self.transaction.get("risk_flags") or []
        income_rel    = self.transaction.get("income_reliability") or "Unknown"
        period_months = self.transaction.get("statement_period_months") or "Unknown"
        recurring_emis = self.transaction.get("recurring_emis_detected") or []

        total_recurring_emi = 0
        for r in recurring_emis:
            val = r.get("amount")
            if val is not None:
                try:
                    total_recurring_emi += float(val)
                except (ValueError, TypeError):
                    pass

        fraud_signals = self.transcript.get("fraud_signals") or []

        financial_summary = f"""
Verified Bank Statement Analysis:
- Verified Monthly Income: ₹{monthly_income:,} (use this over stated income)
- Average Monthly Balance: ₹{avg_balance}
- DTI Ratio (Debt-to-Income): {dti_ratio}
- FOIR (Fixed Obligation-to-Income): {foir}
- Income Reliability Score: {income_rel}
- Statement Period: {period_months} months
- Estimated Recurring EMIs from Statement: ₹{total_recurring_emi:,.0f}/month
- Risk Level: {risk_level}
- Risk Flags from Bank Analysis: {', '.join(risk_flags) if risk_flags else 'None'}

Conversation Fraud Signals (from speech agent): {', '.join(fraud_signals) if fraud_signals else 'None'}
"""

        income_note = (
            f"Remember: use verified bank income (₹{monthly_income:,}) for monthly_income, "
            f"not whatever the customer stated."
            if monthly_income > 0
            else "Note: Bank income data unavailable — use customer-stated income."
        )

        return f"""Below is the complete loan onboarding conversation transcript followed by verified bank statement data.

Conversation Transcript:
{full_transcript}

{financial_summary}

Extract the complete loan application schema from the above. {income_note}"""

    def run(self) -> dict:
        print("🤖 Extractor Agent running with Groq LLaMA (llama-3.3-70b-versatile)...")

        prompt = self.build_prompt()

        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.05,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```json|```", "", raw).strip()

            try:
                loan_schema = json.loads(raw)
                status      = "completed"
            except json.JSONDecodeError as e:
                print(f"⚠️  JSON parse error: {e}")
                print(f"   Raw response: {raw[:300]}")
                json_match = re.search(r"\{.*\}", raw, re.DOTALL)
                if json_match:
                    try:
                        loan_schema = json.loads(json_match.group())
                        status      = "completed"
                    except Exception:
                        loan_schema = {"error": "Failed to parse", "raw": raw}
                        status      = "failed"
                else:
                    loan_schema = {"error": "Failed to parse", "raw": raw}
                    status      = "failed"

        except Exception as e:
            print(f"⚠️  Groq API error: {e}")
            loan_schema = {"error": str(e)}
            status      = "failed"

        output = {
            "agent":       "extractor",
            "status":      status,
            "loan_schema": loan_schema,
        }

        if status == "completed":
            schema  = loan_schema
            raw_amt = schema.get("requested_amount")
            try:
                amt = float(raw_amt) if raw_amt is not None else 0.0
            except (ValueError, TypeError):
                amt = 0.0
            print(f"   Name: {schema.get('customer_name')} | "
                  f"Purpose: {schema.get('loan_purpose')} | "
                  f"Amount: ₹{amt:,.0f}")

        return output


if __name__ == "__main__":
    def load(path):
        with open(path) as f:
            return json.load(f)

    agent = ExtractorAgent(
        transcript_output  = load("transcript_output.json"),
        transaction_output = load("transaction_output.json"),
    )
    agent.run()