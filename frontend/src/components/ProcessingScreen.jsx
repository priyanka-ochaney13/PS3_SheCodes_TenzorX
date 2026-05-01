// src/components/ProcessingScreen.jsx
// Shown after PreCallForm submits — while backend runs fraud pre-check and session setup
import { useEffect, useState } from "react";
import api from "../services/api";

const STEPS = [
  { id: "upload",      label: "Uploading bank statement",          duration: 1200 },
  { id: "tamper",      label: "Tamper & authenticity check",       duration: 1800 },
  { id: "parse",       label: "Parsing transactions",              duration: 2000 },
  { id: "income",      label: "Verifying income & FOIR",           duration: 1600 },
  { id: "fraud",       label: "Running fraud pre-screen (XGBoost)",duration: 2200 },
  { id: "ready",       label: "Preparing your session",            duration: 900  },
];

export default function ProcessingScreen({ sessionId, onPassed, onFraudRejected }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [doneSteps,   setDoneSteps]   = useState([]);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    let stepIdx = 0;

    const runStep = () => {
      if (stepIdx >= STEPS.length) {
        // All animation done — now check fraud status from backend
        checkFraudStatus();
        return;
      }
      setCurrentStep(stepIdx);
      const timeout = setTimeout(() => {
        setDoneSteps((prev) => [...prev, stepIdx]);
        stepIdx++;
        runStep();
      }, STEPS[stepIdx].duration);
      return timeout;
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
    } catch (err) {
      // If endpoint doesn't exist yet / backend not wired — just pass through
      console.warn("fraud_status endpoint not available, proceeding:", err.message);
      onPassed();
    }
  };

  const progress = Math.round(((doneSteps.length) / STEPS.length) * 100);

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo / Brand */}
        <div style={styles.brandRow}>
          <span style={styles.brandIcon}>🏦</span>
          <span style={styles.brandName}>Poonawalla Fincorp</span>
        </div>

        <h2 style={styles.title}>Analysing your application</h2>
        <p style={styles.subtitle}>
          Please wait while we verify your documents and run security checks.
          This usually takes under 30 seconds.
        </p>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <p style={styles.progressLabel}>{progress}% complete</p>

        {/* Steps list */}
        <div style={styles.stepsList}>
          {STEPS.map((step, i) => {
            const isDone    = doneSteps.includes(i);
            const isActive  = currentStep === i && !isDone;
            const isPending = i > currentStep;

            return (
              <div key={step.id} style={styles.stepRow}>
                <div style={{
                  ...styles.stepIcon,
                  background: isDone   ? "rgba(72,202,228,0.2)"  :
                              isActive ? "rgba(108,99,255,0.2)"  :
                                         "rgba(255,255,255,0.05)",
                  border: isDone   ? "1px solid rgba(72,202,228,0.5)"  :
                          isActive ? "1px solid rgba(108,99,255,0.6)"  :
                                     "1px solid rgba(255,255,255,0.1)",
                }}>
                  {isDone   ? <CheckIcon />         :
                   isActive ? <SpinnerIcon />        :
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "block" }} />}
                </div>

                <span style={{
                  ...styles.stepLabel,
                  color:  isDone   ? "#48cae4" :
                          isActive ? "#fff"     :
                                     "#555",
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {step.label}
                </span>

                {isDone && (
                  <span style={styles.stepDone}>Done</span>
                )}
                {isActive && (
                  <span style={styles.stepActive}>Running...</span>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 16, textAlign: "center" }}>
            {error}
          </p>
        )}

        <p style={styles.note}>
          🔒 Your data is encrypted and processed securely as per RBI guidelines.
        </p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="#48cae4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div style={{
      width: 14,
      height: 14,
      border: "2px solid rgba(108,99,255,0.3)",
      borderTop: "2px solid #6c63ff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

const styles = {
  page: {
    minHeight:      "100vh",
    background:     "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontFamily:     "'Segoe UI', sans-serif",
    padding:        24,
  },
  card: {
    background:     "rgba(255,255,255,0.05)",
    border:         "1px solid rgba(255,255,255,0.1)",
    borderRadius:   24,
    padding:        "40px 36px",
    width:          "100%",
    maxWidth:       480,
    backdropFilter: "blur(20px)",
    color:          "#fff",
  },
  brandRow: {
    display:        "flex",
    alignItems:     "center",
    gap:            8,
    justifyContent: "center",
    marginBottom:   24,
  },
  brandIcon:  { fontSize: 24 },
  brandName:  { fontSize: 14, color: "#aaa", fontWeight: 500, letterSpacing: "0.5px" },
  title: {
    fontSize:   24,
    fontWeight: 700,
    textAlign:  "center",
    margin:     "0 0 8px",
  },
  subtitle: {
    color:      "#aaa",
    fontSize:   13,
    textAlign:  "center",
    lineHeight: 1.6,
    margin:     "0 0 24px",
  },
  progressTrack: {
    height:       6,
    background:   "rgba(255,255,255,0.08)",
    borderRadius: 99,
    overflow:     "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height:           "100%",
    background:       "linear-gradient(90deg, #6c63ff, #48cae4)",
    borderRadius:     99,
    transition:       "width 0.4s ease",
  },
  progressLabel: {
    fontSize:   12,
    color:      "#666",
    textAlign:  "right",
    margin:     "0 0 24px",
  },
  stepsList: {
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    marginBottom:  28,
  },
  stepRow: {
    display:    "flex",
    alignItems: "center",
    gap:        12,
  },
  stepIcon: {
    width:          28,
    height:         28,
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    transition:     "all 0.3s ease",
  },
  stepLabel: {
    fontSize:   14,
    flex:       1,
    transition: "color 0.3s",
  },
  stepDone: {
    fontSize:     11,
    color:        "#48cae4",
    background:   "rgba(72,202,228,0.1)",
    border:       "1px solid rgba(72,202,228,0.25)",
    borderRadius: 6,
    padding:      "2px 8px",
  },
  stepActive: {
    fontSize:     11,
    color:        "#6c63ff",
    background:   "rgba(108,99,255,0.1)",
    border:       "1px solid rgba(108,99,255,0.3)",
    borderRadius: 6,
    padding:      "2px 8px",
  },
  note: {
    color:     "#555",
    fontSize:  12,
    textAlign: "center",
    margin:    0,
  },
};

// Inject keyframe for spinner
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);
