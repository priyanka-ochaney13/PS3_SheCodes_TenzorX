"""
SPEECH AGENT
------------
Responsibilities:
  1. Ask structured loan onboarding questions via ElevenLabs TTS
  2. Listen to customer via microphone
  3. Transcribe speech using Groq Whisper (whisper-large-v3-turbo)
  4. Detect fraud signals conversationally using Groq LLaMA
  5. Save full conversation transcript to transcript_output.json

Output (transcript_output.json):
{
  "agent": "speech",
  "status": "completed",
  "language": "en",
  "turns": [
    {"role": "agent", "text": "..."},
    {"role": "customer", "text": "..."}
  ],
  "full_transcript": "Agent: ...\nCustomer: ...",
  "fraud_signals": ["VAGUE_PURPOSE", ...],
  "conversation_risk": "low" | "medium" | "high"
}
"""

import os
import io
import json
import wave
import tempfile
import threading
import numpy as np
import sounddevice as sd
import soundfile as sf
from groq import Groq
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

# ── Audio config ─────────────────────────────────────────
SAMPLE_RATE       = 16000
CHANNELS          = 1
DTYPE             = "int16"
SILENCE_THRESHOLD = 300
SILENCE_DURATION  = 3.0
CHUNK_DURATION    = 0.1
OUTPUT_PATH       = "transcript_output.json"
# ─────────────────────────────────────────────────────────

# Standard loan onboarding questions — maps to Poonawalla policy requirements
STANDARD_QUESTIONS = [
    # Stage 1 — Identity
    "Hello! I'm your loan onboarding assistant from Poonawalla Fincorp. Could you please state your full name clearly?",
    "What is your date of birth?",
    "Could you confirm the city and state mentioned on your Aadhaar card?",

    # Stage 2 — Employment & Income
    "Are you currently salaried, self-employed, or a business owner?",
    "What is the name of your employer or company?",
    "What is your monthly net salary or income approximately?",
    "How long have you been working with your current employer?",

    # Stage 4 — Loan Requirements
    "How much loan amount are you looking for?",
    "What is the purpose of this loan — for example home purchase, business, personal use, or education?",
    "Over how many months would you prefer to repay the loan?",

    # Stage 5 — Existing Obligations
    "Do you currently have any active loans or EMIs running?",
    "If yes, approximately how much do you pay in total EMIs every month? If none, just say zero.",

    # Stage 6 — Assets
    "Do you own any gold jewellery or property such as a house or commercial space?",

    # Stage 7 — Credit
    "Do you know your approximate CIBIL or credit score?",
    "Have you applied for any other loans in the last 30 days?",

    # Stage 8 — Consent
    "Do you consent to this call being recorded and your information being used for loan processing as per RBI guidelines?",

    # Closing
    "Thank you for your time. I have recorded all your responses and will now process your application. Please stay on the line.",
]

# Adaptive follow-up questions triggered by fraud signals detected in real time
FOLLOWUPS = {
    "vague_purpose": "Could you be more specific about exactly what this money will be used for?",
    "income_too_high": "That is a great income level. Could you tell me a bit more about your role and responsibilities at your employer?",
    "short_business": "You mentioned your business has been running for a short time. Could you tell me exactly when you registered it?",
    "contradiction": "I want to make sure I have the right information. Could you help me clarify that again?",
    "multiple_loans": "Have you recently applied for loans at any other institution as well?",
}

CONVERSATIONAL_FRAUD_SYSTEM_PROMPT = """You are an intelligent loan onboarding assistant for an Indian fintech.
Your primary goal is to guide a customer through a list of standard questions to collect necessary information for a loan application.
Your secondary goal is to detect conversational fraud signals.

You will be given the list of standard questions and the conversation transcript so far.
Your task is to analyze the transcript and decide the next action.

Respond ONLY with a valid JSON object. No markdown, no explanation.

JSON format:
{
  "next_action": "ASK_QUESTION" | "ASK_FOLLOWUP" | "COMPLETE_CONVERSATION",
  "next_question": "<The full text of the next question to ask the user, or a follow-up question>",
  "summary": "<One sentence summary of the conversation so far>",
  "fraud_signals": [<list of signal strings>],
  "conversation_risk": "low" | "medium" | "high"
}

Rules for deciding the next action:
1.  **ASK_QUESTION**: If the conversation is ongoing and no immediate fraud follow-up is needed, select the *next logical question* from the standard list that has not been answered yet. Do not ask questions that are made irrelevant by previous answers (e.g., asking for EMI amount if the user said they have no loans).
2.  **ASK_FOLLOWUP**: If you detect a potential fraud signal that requires immediate clarification, set `next_question` to a suitable follow-up question.
3.  **COMPLETE_CONVERSATION**: Once all necessary questions have been satisfactorily answered, use this action. Set `next_question` to the standard closing statement.

Allowed fraud signal strings:
- "VAGUE_LOAN_PURPOSE"
- "INCOME_INCONSISTENT"
- "CONTRADICTORY_ANSWERS"
- "EVASIVE_RESPONSES"
- "SPEECH_INCOMPLETE"
- "MULTIPLE_LOAN_ENQUIRIES"
- "SUSPICIOUS_PURPOSE"

Be conservative in flagging fraud. Prioritize completing the questionnaire.
"high" risk = 3+ signals or a critical signal. "medium" risk = 1-2 signals. "low" risk = 0 signals."""


class SpeechAgent:
    def __init__(self):
        self.groq_client       = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.is_running        = False
        self.turns             = []
        self.fraud_signals     = []
        self.conversation_risk = "low"

    # ── Audio recording ───────────────────────────────────

    def is_silent(self, audio_chunk: np.ndarray) -> bool:
        return np.abs(audio_chunk).mean() < SILENCE_THRESHOLD

    def record_until_silence(self) -> np.ndarray:
        chunk_samples         = int(SAMPLE_RATE * CHUNK_DURATION)
        silence_chunks_needed = int(SILENCE_DURATION / CHUNK_DURATION)

        recorded_chunks = []
        silence_counter = 0
        speech_detected = False
        stop_flag       = threading.Event()

        def wait_for_enter():
            input()
            stop_flag.set()

        threading.Thread(target=wait_for_enter, daemon=True).start()
        print("🎙️  Listening... (Press Enter to stop early)")

        with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE) as mic:
            while self.is_running and not stop_flag.is_set():
                chunk, _ = mic.read(chunk_samples)
                chunk_np  = chunk.flatten()

                if self.is_silent(chunk_np):
                    if speech_detected:
                        silence_counter += 1
                        recorded_chunks.append(chunk_np)
                        if silence_counter >= silence_chunks_needed:
                            break
                else:
                    speech_detected = True
                    silence_counter = 0
                    recorded_chunks.append(chunk_np)

        if not recorded_chunks:
            return np.array([], dtype=np.int16)
        return np.concatenate(recorded_chunks, axis=0)

    def save_wav(self, audio_np: np.ndarray) -> str:
        tmp      = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_path = tmp.name
        tmp.close()
        with wave.open(tmp_path, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_np.astype(np.int16).tobytes())
        return tmp_path

    # ── Transcription via Groq Whisper ────────────────────

    def transcribe(self, wav_path: str) -> str:
        with open(wav_path, "rb") as f:
            response = self.groq_client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=f,
                response_format="text",
                language="en"
            )
        os.unlink(wav_path)
        return str(response).strip() if response else ""

    # ── Text-to-speech via ElevenLabs ─────────────────────

    def speak(self, text: str):
        print(f"\n🤖 Agent: {text}")
        try:
            audio_stream = self.elevenlabs_client.text_to_speech.stream(
                text=text,
                voice_id="JBFqnCBsd6RMkjVDRZzb",
                model_id="eleven_turbo_v2_5",
            )
            audio_bytes  = b"".join(c for c in audio_stream if isinstance(c, bytes))
            audio_buffer = io.BytesIO(audio_bytes)
            data, samplerate = sf.read(audio_buffer, dtype="float32")
            sd.play(data, samplerate)
            sd.wait()
        except Exception as e:
            print(f"⚠️  TTS error (continuing): {e}")
        self.turns.append({"role": "agent", "text": text})

    # ── Conversational fraud analysis via Groq LLaMA ──────
    def get_next_action(self) -> dict:
        transcript_so_far = "\n".join(
            f"{'Agent' if t['role'] == 'agent' else 'Customer'}: {t['text']}"
            for t in self.turns
        )
        standard_questions_text = "\n".join(f"- {q}" for q in STANDARD_QUESTIONS)

        prompt = f"""Here are the standard questions I need to ask:
{standard_questions_text}

Here is the conversation transcript so far:
{transcript_so_far if transcript_so_far else "(No conversation yet. Start with the first question.)"}

Analyze the transcript and decide the next action based on the rules."""

        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": CONVERSATIONAL_FRAUD_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt}
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            print(f"⚠️  LLM action error: {e}")
            # Fallback to stop the conversation on error
            return {"next_action": "COMPLETE_CONVERSATION", "next_question": "I'm sorry, I've encountered a system error. We will have to end this call."}

    def analyze_conversation_for_fraud(self) -> dict:
        if not self.turns:
            return {"fraud_signals": [], "conversation_risk": "low", "needs_followup": None, "summary": "No conversation to analyze."}

        transcript_so_far = "\n".join(
            f"{'Agent' if t['role'] == 'agent' else 'Customer'}: {t['text']}"
            for t in self.turns
        )

        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": CONVERSATIONAL_FRAUD_SYSTEM_PROMPT},
                    {"role": "user",   "content": f"Analyze this loan onboarding transcript for fraud signals:\n\n{transcript_so_far}"}
                ],
                temperature=0.1,
                max_tokens=512,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown fences if present
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            print(f"⚠️  Fraud analysis error: {e}")
            return {"fraud_signals": [], "conversation_risk": "low", "needs_followup": None, "summary": "Analysis failed."}

    # ── Save output ───────────────────────────────────────

    def save_output(self) -> dict:
        full_transcript = "\n".join(
            f"{'Agent' if t['role'] == 'agent' else 'Customer'}: {t['text']}"
            for t in self.turns
        )
        output = {
            "agent":             "speech",
            "status":            "completed",
            "language":          "en",
            "turns":             self.turns,
            "full_transcript":   full_transcript,
            "fraud_signals":     self.fraud_signals,
            "conversation_risk": self.conversation_risk,
        }
        with open(OUTPUT_PATH, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n✅ Transcript saved → {OUTPUT_PATH}")
        return output

    # ── Main loop ─────────────────────────────────────────

    def run(self) -> dict:
        self.is_running = True
        print("\n🚀 Speech Agent started.\n")

        while self.is_running:
            # 1. Let the LLM decide the next action
            action = self.get_next_action()
            next_action = action.get("next_action")
            question = action.get("next_question")

            if not next_action or not question:
                print("LLM did not provide a valid next action. Ending conversation.")
                break

            # 2. Execute the action
            self.speak(question)

            # Update fraud signals and risk from the latest analysis
            self.fraud_signals = action.get("fraud_signals", [])
            self.conversation_risk = action.get("conversation_risk", "low")
            if self.fraud_signals:
                print(f"🔎 Current risk: {self.conversation_risk.upper()} | Signals: {', '.join(self.fraud_signals)}")


            if next_action == "COMPLETE_CONVERSATION":
                print("\nLLM decided to end the conversation.")
                break

            # 3. Listen for the customer's response
            audio_np = self.record_until_silence()
            if len(audio_np) == 0:
                print("(no audio captured)")
                self.turns.append({"role": "customer", "text": ""})
                continue

            print("Transcribing...", end="\r")
            wav_path = self.save_wav(audio_np)
            text = self.transcribe(wav_path)

            if text:
                print(f"👤 Customer: {text}")
                self.turns.append({"role": "customer", "text": text})
            else:
                print("(could not transcribe)")
                self.turns.append({"role": "customer", "text": ""})

        print(f"\n📊 Final conversation risk level: {self.conversation_risk.upper()}")
        if self.fraud_signals:
            print(f"⚠️  Final fraud signals: {', '.join(self.fraud_signals)}")

        return self.save_output()

    def stop(self):
        self.is_running = False


if __name__ == "__main__":
    agent = SpeechAgent()
    try:
        agent.run()
    except KeyboardInterrupt:
        print("\n\nStopping...")
        agent.stop()

