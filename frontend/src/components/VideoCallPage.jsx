// src/components/VideoCallPage.jsx
// Pure WebRTC video call — no Daily.co, no credit card needed
// Camera/mic accessed directly via browser getUserMedia API
import { useEffect, useRef, useState, useCallback } from "react";
import api from "../services/api";

const AGENT_QUESTIONS = [
  "Hello! I'm your loan onboarding assistant. Could you please tell me your full name?",
  "What is the purpose of this loan — home purchase, business, or personal use?",
  "What loan amount are you looking for approximately?",
  "Could you tell me your current monthly income?",
  "Do you have any existing EMIs or loans currently running?",
  "Thank you! I have recorded all your responses and will now process your application.",
];

export default function VideoCallPage({ sessionId, kycAddress, statedIncome, onCallEnd }) {
  const videoRef        = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef       = useRef(null);
  const chunksRef       = useRef([]);

  const [phase, setPhase]               = useState("consent");     // consent | active | processing | done
  const [consentGiven, setConsentGiven] = useState(false);
  const [questionIdx, setQuestionIdx]   = useState(0);
  const [isRecording, setIsRecording]   = useState(false);
  const [transcript, setTranscript]     = useState([]);            // [{role, text}]
  const [agentStatus, setAgentStatus]   = useState({});
  const [error, setError]               = useState(null);
  const [geoCoords, setGeoCoords]       = useState(null);
  const [timeLeft, setTimeLeft]         = useState(null);

  // ── Get GPS on mount ─────────────────────────────────
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        ()    => console.warn("Geolocation denied or unavailable")
      );
    }
  }, []);

  // ── Start camera/mic ──────────────────────────────────
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current      = stream;
        videoRef.current.srcObject = stream;
      } catch (err) {
        setError("Camera/microphone access denied. Please allow access and refresh.");
      }
    }
    startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Consent handler ───────────────────────────────────
  const handleConsent = async () => {
    setConsentGiven(true);
    try {
      await api.post(`/session/${sessionId}/consent`);
    } catch (_) {}
    setPhase("active");
    speakQuestion(0);
  };

  // ── Text-to-speech (browser built-in, no API needed) ──
  const speakQuestion = useCallback((idx) => {
    const q = AGENT_QUESTIONS[idx];
    setTranscript((prev) => [...prev, { role: "agent", text: q }]);

    const utterance = new SpeechSynthesisUtterance(q);
    utterance.rate  = 0.9;
    utterance.onend = () => {
      if (idx < AGENT_QUESTIONS.length - 1) {
        // Start recording customer response
        startRecording(idx);
      } else {
        // Last question — end call
        endCall();
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Audio recording for each answer ───────────────────
  const startRecording = (questionIndex) => {
    if (!streamRef.current) return;
    setIsRecording(true);
    setTimeLeft(15);

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setIsRecording(false);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await sendAudioToBackend(blob, questionIndex);
    };

    recorder.start();

    // Auto-stop after 15 seconds
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); stopRecording(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  // ── Send audio chunk to backend for transcription ─────
  const sendAudioToBackend = async (audioBlob, questionIndex) => {
    try {
      const formData = new FormData();
      formData.append("audio",      audioBlob, "answer.webm");
      formData.append("session_id", sessionId);
      formData.append("question",   AGENT_QUESTIONS[questionIndex]);

      const res = await api.post("/agents/transcribe_chunk", formData);
      const customerText = res.data.transcript || "(no response)";

      setTranscript((prev) => [...prev, { role: "customer", text: customerText }]);
    } catch (_) {
      setTranscript((prev) => [...prev, { role: "customer", text: "(could not transcribe)" }]);
    }

    // Move to next question
    const next = questionIndex + 1;
    setQuestionIdx(next);
    setTimeout(() => speakQuestion(next), 800);
  };

  // ── Capture frame for DeepFace ────────────────────────
  const captureFrame = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas  = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("frame",      blob, "frame.jpg");
      formData.append("session_id", sessionId);
      try { await api.post("/agents/deepface", formData); } catch (_) {}
    }, "image/jpeg");
  };

  // ── End call — run all agents ─────────────────────────
  const endCall = async () => {
    setPhase("processing");
    window.speechSynthesis.cancel();

    // Capture face frame before stopping camera
    await captureFrame();

    // Stop all media tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      // Trigger full pipeline on backend
      const res = await api.post(`/agents/run/${sessionId}`, {
        geo_coords:    geoCoords,
        kyc_address:   kycAddress,
        stated_income: statedIncome,
      });

      setAgentStatus(res.data.agent_statuses || {});

      // Generate loan offer
      const offerRes = await api.post(`/loan/generate/${sessionId}`);
      setPhase("done");
      onCallEnd(offerRes.data);
    } catch (err) {
      setError("Pipeline error: " + (err.response?.data?.detail || err.message));
      setPhase("active");
    }
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Consent Modal */}
      {phase === "consent" && (
        <div style={styles.modal}>
          <h2 style={{ margin: "0 0 12px" }}>📋 RBI V-CIP Consent</h2>
          <p style={styles.consentText}>
            This video call is being recorded for regulatory compliance as per RBI
            Video-based Customer Identification Process (V-CIP) guidelines.
            Your face will be verified against your KYC records.
            Your location will be checked against your registered address.
          </p>
          <p style={styles.consentText}>
            By clicking <strong>I Agree</strong>, you consent to this recording and verification.
          </p>
          <button style={styles.btn} onClick={handleConsent}>✅ I Agree — Start Call</button>
        </div>
      )}

      {/* Main call UI */}
      <div style={styles.layout}>
        {/* Left — video */}
        <div style={styles.videoPanel}>
          <div style={styles.videoWrapper}>
            <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
            {isRecording && (
              <div style={styles.recBadge}>
                🔴 Recording {timeLeft}s — speak now
              </div>
            )}
            {!isRecording && phase === "active" && (
              <div style={{ ...styles.recBadge, background: "rgba(0,0,0,0.6)" }}>
                Agent speaking...
              </div>
            )}
          </div>

          {/* Manual stop button */}
          {isRecording && (
            <button style={styles.stopBtn} onClick={stopRecording}>
              ⏹ Done Speaking
            </button>
          )}

          {/* Progress */}
          {phase === "active" && (
            <div style={styles.progress}>
              {AGENT_QUESTIONS.slice(0, -1).map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.dot,
                    background: i < questionIdx ? "#6c63ff" : i === questionIdx ? "#48cae4" : "#444"
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — transcript */}
        <div style={styles.transcriptPanel}>
          <h3 style={styles.transcriptTitle}>Live Transcript</h3>
          <div style={styles.transcriptBody}>
            {transcript.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>Transcript will appear here...</p>
            )}
            {transcript.map((t, i) => (
              <div key={i} style={{
                ...styles.bubble,
                background:   t.role === "agent" ? "rgba(108,99,255,0.2)" : "rgba(72,202,228,0.15)",
                alignSelf:    t.role === "agent" ? "flex-start" : "flex-end",
                borderRadius: t.role === "agent" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
              }}>
                <span style={styles.bubbleRole}>
                  {t.role === "agent" ? "🤖 Agent" : "👤 You"}
                </span>
                <p style={styles.bubbleText}>{t.text}</p>
              </div>
            ))}
          </div>

          {/* Agent status during processing */}
          {phase === "processing" && (
            <div style={styles.statusBox}>
              <p style={{ color: "#48cae4", fontWeight: 600, marginBottom: 8 }}>
                ⚙️ Running verification agents...
              </p>
              {["speech", "deepface", "transaction", "geo", "fraud"].map((a) => (
                <div key={a} style={styles.statusRow}>
                  <span style={{ color: "#aaa", fontSize: 13 }}>{a}</span>
                  <span style={{ fontSize: 13 }}>
                    {agentStatus[a] === "passed"    ? "✅ passed"  :
                     agentStatus[a] === "failed"    ? "❌ failed"  :
                     agentStatus[a] === "completed" ? "✅ done"    : "⏳ running"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight:      "100vh",
    background:     "#0d0d0d",
    color:          "#fff",
    fontFamily:     "'Segoe UI', sans-serif",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    padding:        16,
  },
  modal: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.85)",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         100,
    padding:        32,
  },
  consentText: { color: "#ccc", maxWidth: 480, textAlign: "center", lineHeight: 1.7, marginBottom: 12 },
  layout: {
    display:   "flex",
    gap:       24,
    width:     "100%",
    maxWidth:  1100,
    flexWrap:  "wrap",
  },
  videoPanel: {
    flex:          "1 1 420px",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
  },
  videoWrapper: {
    position:     "relative",
    borderRadius: 16,
    overflow:     "hidden",
    background:   "#111",
    aspectRatio:  "4/3",
  },
  video: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" },
  recBadge: {
    position:     "absolute",
    bottom:       12,
    left:         12,
    background:   "rgba(220,50,50,0.85)",
    borderRadius: 8,
    padding:      "6px 12px",
    fontSize:     13,
    fontWeight:   600,
  },
  stopBtn: {
    padding:      "12px",
    borderRadius: 10,
    border:       "none",
    background:   "#ff4757",
    color:        "#fff",
    fontSize:     15,
    fontWeight:   700,
    cursor:       "pointer",
  },
  progress: { display: "flex", gap: 8, justifyContent: "center" },
  dot:      { width: 12, height: 12, borderRadius: "50%", transition: "background 0.3s" },
  transcriptPanel: {
    flex:          "1 1 320px",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    maxHeight:     560,
  },
  transcriptTitle: { margin: 0, fontSize: 16, color: "#aaa", fontWeight: 600 },
  transcriptBody: {
    flex:          1,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    padding:       4,
  },
  bubble:     { padding: "10px 14px", maxWidth: "85%" },
  bubbleRole: { fontSize: 11, color: "#888", display: "block", marginBottom: 4 },
  bubbleText: { margin: 0, fontSize: 14, lineHeight: 1.5 },
  statusBox:  { background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16 },
  statusRow:  { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  btn: {
    padding:      "14px 32px",
    borderRadius: 10,
    border:       "none",
    background:   "linear-gradient(90deg, #6c63ff, #48cae4)",
    color:        "#fff",
    fontSize:     16,
    fontWeight:   700,
    cursor:       "pointer",
    marginTop:    16,
  },
  error: { color: "#ff6b6b", fontSize: 13 },
};
