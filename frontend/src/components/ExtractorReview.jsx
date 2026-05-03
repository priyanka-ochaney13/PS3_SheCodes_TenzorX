// src/components/ExtractorReview.jsx — Pipeline orchestration + review
// ON MOUNT:
//   1. Poll GET /session/{id} every 1s for agents_completed (geo + deepface), 30s timeout
//   2. POST /loan/pipeline/{id} with 180s timeout
//   3. Check fraud_decision — navigate("/rejected") if halt
//   4. GET /agents/{id}/extractor/result
//   5. Display loan_schema for review
// ON CONFIRM:
//   6. GET /loan/{id}/summary
//   7. Call onConfirmed + navigate("/offer")

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const NAVY   = "#001840";
const ORANGE = "#1a56db";

const LOAN_PURPOSE_LABELS = {
  "home purchase": "Home Purchase", "home renovation": "Home Renovation",
  "business": "Business", "working capital": "Working Capital",
  "personal": "Personal", "education": "Education",
  "medical": "Medical", "vehicle": "Vehicle", "gold loan": "Gold Loan",
};
const EMPLOYMENT_LABELS = {
  "salaried": "Salaried", "self-employed": "Self-Employed",
  "business-owner": "Business Owner", "professional": "Professional (CA/Doctor/Lawyer)",
  "unknown": "Not Specified",
};

export default function ExtractorReview({ sessionId, loanResult, onConfirmed, onBack }) {
  const navigate = useNavigate();
  const [schema,        setSchema]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState("polling");  // polling | running | complete | error

  useEffect(() => {
    const runPipeline = async () => {
      try {
        // ── Step 1: Poll for geo + deepface completion (max 30s) ──
        setPipelinePhase("polling");
        let agentsReady = false;
        let pollAttempts = 0;
        const maxPollAttempts = 30;

        while (!agentsReady && pollAttempts < maxPollAttempts) {
          try {
            const sessionRes = await api.get(`/session/${sessionId}`);
            const completed = sessionRes.data?.agents_completed || [];
            agentsReady = completed.includes("geo") && completed.includes("deepface");
            if (!agentsReady) {
              await new Promise((r) => setTimeout(r, 1000));
              pollAttempts += 1;
            }
          } catch {
            await new Promise((r) => setTimeout(r, 1000));
            pollAttempts += 1;
          }
        }

        // ── Step 2: Run pipeline (max 180s) ──
        setPipelinePhase("running");
        const pipelineAbort = new AbortController();
        const pipelineTimeout = setTimeout(() => pipelineAbort.abort(), 180000);

        let pipelineRes;
        try {
          pipelineRes = await api.post(`/loan/pipeline/${sessionId}`, {}, {
            signal: pipelineAbort.signal,
          });
        } catch (err) {
          if (err.name === "AbortError") {
            throw new Error("Pipeline analysis timed out after 180 seconds");
          }
          throw err;
        } finally {
          clearTimeout(pipelineTimeout);
        }

        // ── Step 3: Check fraud decision ──
        if (pipelineRes.data?.fraud_decision === "halt" || pipelineRes.data?.halted_reason) {
          navigate("/rejected", {
            state: {
              fraudInfo: {
                decision: pipelineRes.data?.fraud_decision,
                reason: pipelineRes.data?.halted_reason,
                sessionId,
              },
            },
          });
          return;
        }

        // ── Step 4: Fetch extractor result ──
        const extractorRes = await api.get(`/agents/${sessionId}/extractor/result`);
        const extractedSchema = extractorRes.data?.result?.loan_schema;

        if (!extractedSchema) {
          throw new Error("No extractor result available");
        }

        setSchema(extractedSchema);
        setPipelinePhase("complete");
        setLoading(false);

      } catch (err) {
        setError(err.message || "Pipeline error");
        setPipelinePhase("error");
        setLoading(false);
      }
    };

    runPipeline();
  }, [sessionId, navigate]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // Pipeline already ran — fetch summary and navigate to offer
      const res = await api.get(`/loan/${sessionId}/summary`);
      onConfirmed(res.data.data);
      navigate("/offer");
    } catch (err) {
      setError("Failed to fetch offer: " + (err.response?.data?.detail || err.message));
      setSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Poonawalla Fincorp</span>
        </div>
        <span style={{ fontSize: 12, color: "#888" }}>Step 4 of 4 — Review & Confirm</span>
      </div>

      <div style={s.body}>
        <div style={s.card}>

          {loading && (
            <div style={s.center}>
              <div style={s.spinner} />
              <p style={{ color: "#888", fontSize: 14, marginTop: 16 }}>
                {pipelinePhase === "polling" && "Waiting for verification agents..."}
                {pipelinePhase === "running" && "Analysing your application..."}
              </p>
            </div>
          )}

          {!loading && error && (
            <div style={s.center}>
              <p style={{ color: "#dc2626" }}>⚠️ {error}</p>
              <button style={{ ...s.btnBack, marginTop: 16 }} onClick={onBack}>← Back</button>
            </div>
          )}

          {!loading && !error && schema && (
            <>
              {/* Header */}
              <div style={s.header}>
                <div style={s.headerIcon}>🤖</div>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>AI Extracted Your Application</h1>
                  <p style={{ fontSize: 13, color: "#888", margin: 0, lineHeight: 1.5 }}>
                    Our AI analysed your call and verified your identity. Review what was captured, then confirm to generate your offer.
                  </p>
                </div>
              </div>

              <Section title="Identity" icon="👤">
                <Row label="Full Name"     value={schema.customer_name} />
                <Row label="Date of Birth" value={schema.date_of_birth} />
                <Row label="City"          value={schema.city} />
              </Section>

              <Section title="Loan Details" icon="💰">
                <Row label="Loan Purpose"      value={LOAN_PURPOSE_LABELS[schema.loan_purpose] || schema.loan_purpose} />
                <Row label="Requested Amount"  value={schema.requested_amount ? `₹${Number(schema.requested_amount).toLocaleString("en-IN")}` : null} />
                <Row label="Tenure Preference" value={schema.loan_tenure_preference ? `${schema.loan_tenure_preference} months` : null} />
              </Section>

              <Section title="Financial Profile" icon="📊">
                <Row label="Monthly Income (Verified)" value={schema.monthly_income ? `₹${Number(schema.monthly_income).toLocaleString("en-IN")}` : null} highlight />
                <Row label="Existing EMIs / Month"     value={schema.existing_emis ? `₹${Number(schema.existing_emis).toLocaleString("en-IN")}` : null} />
                <Row label="Employment Type"           value={EMPLOYMENT_LABELS[schema.employment_type] || schema.employment_type} />
                <Row label="Employer / Company"        value={schema.employer_name} />
                <Row label="Self-Reported CIBIL"       value={schema.credit_score_self_reported ? `${schema.credit_score_self_reported} / 900` : null} />
              </Section>

              {(schema.employment_type === "self-employed" || schema.employment_type === "business-owner") && (
                <Section title="Business Details" icon="🏢">
                  <Row label="Business Vintage" value={schema.business_vintage_months ? `${schema.business_vintage_months} months` : null} />
                  <Row label="Annual Turnover"  value={schema.annual_turnover ? `₹${Number(schema.annual_turnover).toLocaleString("en-IN")}` : null} />
                </Section>
              )}

              <Section title="Assets & Compliance" icon="🔍">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 0" }}>
                  <Pill label={schema.has_gold_assets ? "Owns Gold" : "No Gold"}         active={schema.has_gold_assets} />
                  <Pill label={schema.owns_property   ? "Owns Property" : "No Property"} active={schema.owns_property} />
                  <Pill label={schema.consent_given   ? "Consent Given" : "No Consent"}  active={schema.consent_given} good={schema.consent_given} />
                  <Pill label={`Applied elsewhere: ${schema.applied_elsewhere_recently ? "Yes" : "No"}`} active={false} />
                </div>
              </Section>

              {schema.additional_notes && (
                <Section title="Additional Notes" icon="📝">
                  <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.7 }}>{schema.additional_notes}</p>
                </Section>
              )}

              <div style={s.disclaimer}>
                ⚠️ This data was automatically extracted by AI. If anything looks incorrect, contact support before proceeding.
              </div>

              {error && <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 }}>⚠️ {error}</p>}

              <div style={s.btnRow}>
                <button style={s.btnBack} onClick={onBack} disabled={submitting}>← Back</button>
                <button style={{ ...s.btnPrimary, opacity: submitting ? 0.7 : 1 }} onClick={handleConfirm} disabled={submitting}>
                  {submitting
                    ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ ...s.spinner, width: 16, height: 16 }} />Generating...</span>
                    : "✅ Confirm & Get My Offer →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.6px" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  const missing = value == null || value === "" || value === "unknown";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderRadius: 8, background: "#fafbfc", gap: 16 }}>
      <span style={{ fontSize: 13, color: "#888", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, textAlign: "right", color: missing ? "#ddd" : highlight ? ORANGE : "#333", fontWeight: highlight ? 700 : 400, fontStyle: missing ? "italic" : "normal" }}>
        {missing ? "Not captured" : String(value)}
      </span>
    </div>
  );
}

function Pill({ label, active, good }) {
  return (
    <span style={{
      padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500,
      color:      active && good  ? "#166534" : active ? NAVY : "#888",
      background: active && good  ? "#dcfce7" : active ? "#e8f0fe" : "#f5f7fa",
      border:     active && good  ? "1px solid #bbf7d0" : active ? "1px solid #c7d2fe" : "1px solid #e8ecf0",
    }}>
      {label}
    </span>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  topBar:  { background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  body:    { flex: 1, display: "flex", justifyContent: "center", padding: "32px 24px" },
  card:    { background: "#fff", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 580, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", height: "fit-content" },
  center:  { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 0" },
  header:  { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #f0f4f8" },
  headerIcon: { width: 48, height: 48, borderRadius: 12, background: "rgba(26,86,219,0.08)", border: "1px solid rgba(26,86,219,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 },
  disclaimer: { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "#1a56db", lineHeight: 1.6 },
  btnRow:  { display: "flex", gap: 12 },
  btnPrimary: { flex: 1, padding: 14, borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" },
  btnBack: { padding: "14px 20px", borderRadius: 10, border: "1px solid #e8ecf0", background: "#fff", color: "#888", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Segoe UI', sans-serif" },
  spinner: { width: 24, height: 24, border: "3px solid #f0f4f8", borderTop: `3px solid ${ORANGE}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" },
};
