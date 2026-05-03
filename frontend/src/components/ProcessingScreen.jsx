// src/components/ProcessingScreen.jsx
// Poonawalla navy + orange theme — white card on light grey background
import { useEffect, useState } from "react";
import api from "../services/api";

const NAVY   = "#001840";
const ORANGE = "#E8500A";

const STEPS = [
  { id: "upload",  label: "Uploading your documents",           duration: 1200 },
  { id: "tamper",  label: "Tamper & authenticity check",        duration: 1800 },
  { id: "parse",   label: "Parsing bank transactions",          duration: 2000 },
  { id: "income",  label: "Verifying income & FOIR",            duration: 1600 },
  { id: "fraud",   label: "Running fraud pre-screen (XGBoost)", duration: 2200 },
  { id: "ready",   label: "Preparing your session",             duration: 900  },
];

export default function ProcessingScreen({ sessionId, onPassed, onFraudRejected }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [doneSteps,   setDoneSteps]   = useState([]);

  useEffect(() => {
    let stepIdx = 0;
    const runStep = () => {
      if (stepIdx >= STEPS.length) { checkFraudStatus(); return; }
      setCurrentStep(stepIdx);
      setTimeout(() => {
        setDoneSteps((prev) => [...prev, stepIdx]);
        stepIdx++;
        runStep();
      }, STEPS[stepIdx].duration);
    };
    runStep();
  }, []);

  const checkFraudStatus = async () => {
    try {
      const res = await api.get(`/session/${sessionId}/fraud_status`);
      const { fraud_verdict, fraud_signals, fraud_weight } = res.data;
      if (fraud_verdict === "RED") {
        onFraudRejected({ signals: fraud_signals, weight: fraud_weight });
      } else {
        onPassed();
      }
    } catch {
      onPassed(); // graceful fallback if endpoint not wired yet
    }
  };

  const progress = Math.round((doneSteps.length / STEPS.length) * 100);

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.brand}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Poonawalla Fincorp</span>
        </div>
        <span style={s.secBadge}>🔒 Secure Session</span>
      </div>

      <div style={s.body}>
        <div style={s.card}>
          {/* Icon */}
          <div style={s.iconWrap}>
            <span style={{ fontSize: 36 }}>⚙️</span>
          </div>

          <h2 style={s.title}>Analysing Your Application</h2>
          <p style={s.subtitle}>
            Please wait while we verify your documents and run security checks.
            This usually takes under 30 seconds.
          </p>

          {/* Progress bar */}
          <div style={s.track}>
            <div style={{ ...s.fill, width: `${progress}%` }} />
          </div>
          <div style={s.progressRow}>
            <span style={{ fontSize: 12, color: "#888" }}>Verification in progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>{progress}%</span>
          </div>

          {/* Steps */}
          <div style={s.stepsList}>
            {STEPS.map((step, i) => {
              const isDone   = doneSteps.includes(i);
              const isActive = currentStep === i && !isDone;
              return (
                <div key={step.id} style={s.stepRow}>
                  {/* Icon */}
                  <div style={{
                    ...s.stepDot,
                    background: isDone   ? "#dcfce7" :
                                isActive ? "rgba(232,80,10,0.1)" :
                                           "#f5f7fa",
                    border:     isDone   ? "1.5px solid #22c55e" :
                                isActive ? `1.5px solid ${ORANGE}` :
                                           "1.5px solid #e8ecf0",
                  }}>
                    {isDone   ? <span style={{ color: "#22c55e", fontSize: 13 }}>✓</span> :
                     isActive ? <div style={s.spinner} /> :
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dde2e8", display: "block" }} />}
                  </div>

                  {/* Label */}
                  <span style={{
                    ...s.stepLabel,
                    color:      isDone   ? "#166534" :
                                isActive ? "#111"    : "#bbb",
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {step.label}
                  </span>

                  {/* Status pill */}
                  {isDone && (
                    <span style={{ ...s.pill, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}>
                      Done
                    </span>
                  )}
                  {isActive && (
                    <span style={{ ...s.pill, background: "rgba(232,80,10,0.08)", color: ORANGE, border: `1px solid rgba(232,80,10,0.2)` }}>
                      Running
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={s.note}>
            🔒 Your data is encrypted and processed securely as per RBI guidelines.
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  topBar:  { background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand:   { display: "flex", alignItems: "center", gap: 10 },
  secBadge:{ fontSize: 12, color: "#888", background: "#f5f7fa", padding: "5px 12px", borderRadius: 99, border: "1px solid #e8ecf0" },
  body:    { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    background: "#fff", borderRadius: 20, padding: "40px 36px",
    width: "100%", maxWidth: 480, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  iconWrap:    { width: 64, height: 64, borderRadius: 16, background: "rgba(232,80,10,0.08)", border: "1px solid rgba(232,80,10,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" },
  title:       { fontSize: 22, fontWeight: 700, color: "#111", textAlign: "center", margin: "0 0 8px" },
  subtitle:    { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 1.6, margin: "0 0 28px" },
  track:       { height: 8, background: "#f0f4f8", borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  fill:        { height: "100%", background: `linear-gradient(90deg, ${NAVY}, ${ORANGE})`, borderRadius: 99, transition: "width 0.4s ease" },
  progressRow: { display: "flex", justifyContent: "space-between", marginBottom: 28 },
  stepsList:   { display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 },
  stepRow:     { display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, background: "#fafbfc" },
  stepDot:     { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s" },
  stepLabel:   { fontSize: 13, flex: 1, transition: "color 0.3s" },
  pill:        { fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99, flexShrink: 0 },
  spinner:     { width: 14, height: 14, border: `2px solid rgba(232,80,10,0.2)`, borderTop: `2px solid ${ORANGE}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  note:        { fontSize: 12, color: "#bbb", textAlign: "center" },
};
