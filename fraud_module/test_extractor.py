import json
from extractor_agent import ExtractorAgent

transcript_output = {
    "full_transcript": "My name is Rahul Sharma. I need 5 lakh rupees for home renovation. I earn 50,000 per month. I work at TCS as a software engineer. I have one EMI of 8000 per month. My CIBIL score is around 760. Yes I consent to recording.",
    "fraud_signals": []
}

transaction_output = {
    "monthly_income": 50000,
    "average_monthly_balance": 65000,
    "dti_ratio": 0.16,
    "foir": 0.3,
    "risk_level": "LOW",
    "risk_flags": [],
    "income_reliability": 0.95,
    "statement_period_months": 3,
    "recurring_emis_detected": [{"amount": 8000}]
}

agent = ExtractorAgent(transcript_output, transaction_output)
result = agent.run()