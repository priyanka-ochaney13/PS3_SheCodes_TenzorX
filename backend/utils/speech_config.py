"""
Speech Agent Configuration
---------------------------
Constants for TTS, LLM conversation control, and fraud analysis.
"""

# Standard questions to ask during KYC video call
STANDARD_QUESTIONS = [
    "What is your full name?",
    "What is your date of birth?",
    "What is your current employment status?",
    "What is your job title or role?",
    "How long have you been with your current employer?",
    "What is your monthly salary or income?",
    "What is your residential address?",
    "Do you have any existing loans or credit cards?",
    "What is the purpose of this loan?",
    "What loan amount are you requesting?",
]

# System prompt for conversational fraud detection
CONVERSATIONAL_FRAUD_SYSTEM_PROMPT = """You are a fraud detection AI specialized in analyzing loan application conversations.
Analyze the conversation between a loan agent and customer for fraud signals and red flags.

Your job:
1. Track whether the customer answers questions consistently.
2. Detect contradictions or evasive responses.
3. Flag suspicious patterns like:
   - Income claims that don't match employment history
   - Vague or overly rehearsed answers
   - Refusal to answer standard KYC questions
   - Inconsistencies in personal details
   - Signs of identity spoofing or impersonation
4. Estimate overall conversation risk (low, medium, high).

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no extra text.

For get_next_action (mid-call analysis), respond with:
{
  "next_action": "CONTINUE_CONVERSATION" or "COMPLETE_CONVERSATION",
  "next_question": "the next question to ask if CONTINUE, or closing statement if COMPLETE",
  "fraud_signals": ["signal1", "signal2", ...],
  "conversation_risk": "low|medium|high",
  "summary": "brief summary of findings so far"
}

For analyze_conversation_for_fraud (final analysis), respond with:
{
  "fraud_signals": ["signal1", "signal2", ...],
  "conversation_risk": "low|medium|high",
  "summary": "comprehensive fraud analysis summary"
}

If you cannot parse the conversation or detect signals, default to low risk and empty fraud_signals.
"""
