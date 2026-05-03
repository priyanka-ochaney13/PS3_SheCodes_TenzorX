// src/components/PreCallForm.jsx
// ALL documents required and uploaded immediately on submission.
// Flow:
//   Step 1 → personal info
//   Step 2 → upload ALL documents (bank stmt + aadhaar + pan + kyc photo)
//   On submit → POST /session/create (JSON) then upload all 4 files
import { useState } from "react";
import api from "../services/api";

const NAVY   = "#001840";
const ORANGE = "#E8500A";
const BG     = "#f0f4f8";

const LOAN_TYPES = [
  { value: "personal_loan_salaried",      label: "Personal Loan — Salaried" },
  { value: "personal_loan_self_employed", label: "Personal Loan — Self Employed" },
  { value: "business_loan",              label: "Business Loan" },
  { value: "professional_loan",          label: "Professional Loan" },
  { value: "lap",                        label: "Loan Against Property" },
];

export default function PreCallForm({ user, onStartCall, onBack }) {
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    fullName:     user?.name  || "",
    phone:        "",
    email:        user?.email || "",
    kycAddress:   "",
    statedIncome: "",
    loanType:     "",
    pdfPassword:  "",
  });

  // ALL 4 docs required
  const [bankStatement, setBankStatement] = useState(null);
  const [kycPhoto,      setKycPhoto]      = useState(null);
  const [aadhaarCard,   setAadhaarCard]   = useState(null);
  const [panCard,       setPanCard]       = useState(null);

  const [loading,   setLoading]   = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error,     setError]     = useState(null);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Step 1 validation ────────────────────────────────
  const handleNextStep = () => {
    if (!form.fullName || !form.phone || !form.email ||
        !form.kycAddress || !form.statedIncome || !form.loanType) {
      setError("Please fill all required fields.");
      return;
    }
    setError(null);
    setStep(2);
  };

  // ── Step 2 submit — all docs required ────────────────
  const handleSubmit = async () => {
    if (!bankStatement) { setError("Bank statement PDF is required.");     return; }
    if (!kycPhoto)      { setError("KYC / selfie photo is required.");     return; }
    if (!aadhaarCard)   { setError("Aadhaar card upload is required.");    return; }
    if (!panCard)       { setError("PAN card upload is required.");        return; }

    setError(null);
    setLoading(true);

    try {
      // 1. Create session
      setUploadMsg("Creating your session…");
      const sessionRes = await api.post("/session/create", {
        full_name:     form.fullName,
        phone:         form.phone,
        email:         form.email,
        kyc_address:   form.kycAddress,
        stated_income: parseInt(form.statedIncome),
        loan_type:     form.loanType,
        pdf_password:  form.pdfPassword || null,
      });
      const sessionId = sessionRes.data.session_id;

      // 2. Upload bank statement
      setUploadMsg("Uploading bank statement (1/4)…");
      const fd1 = new FormData();
      fd1.append("session_id", sessionId);
      fd1.append("file", bankStatement);
      await api.post("/documents/upload/bank-statement", fd1, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // 3. Upload KYC photo
      setUploadMsg("Uploading KYC photo (2/4)…");
      const fd2 = new FormData();
      fd2.append("session_id", sessionId);
      fd2.append("file", kycPhoto);
      await api.post("/documents/upload/kyc-photo", fd2, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // 4. Upload Aadhaar
      setUploadMsg("Uploading Aadhaar card (3/4)…");
      const fd3 = new FormData();
      fd3.append("session_id", sessionId);
      fd3.append("file", aadhaarCard);
      await api.post("/documents/upload/aadhaar-card", fd3, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // 5. Upload PAN
      setUploadMsg("Uploading PAN card (4/4)…");
      const fd4 = new FormData();
      fd4.append("session_id", sessionId);
      fd4.append("file", panCard);
      await api.post("/documents/upload/pan-card", fd4, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Done
      onStartCall({
        sessionId,
        kycAddress:   form.kycAddress,
        statedIncome: parseInt(form.statedIncome),
        loanType:     form.loanType,
      });

    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start session. Is the backend running?");
    } finally {
      setLoading(false);
      setUploadMsg("");
    }
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pf-input:focus  { border-color: ${ORANGE} !important; outline: none; box-shadow: 0 0 0 3px rgba(232,80,10,0.1); }
        .pf-file:hover   { border-color: ${ORANGE} !important; background: #fff8f5 !important; }
        .pf-primary:hover{ background: #c7420a !important; transform: translateY(-1px); }
        .pf-back:hover   { background: #e8ecf0 !important; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <div style={s.brand}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Poonawalla Fincorp</span>
        </div>
        <div style={s.stepRow}>
          <StepDot n={1} label="Your Info"   active={step === 1} done={step > 1} />
          <div style={s.stepLine} />
          <StepDot n={2} label="Documents"   active={step === 2} done={false} />
        </div>
      </div>

      {/* ── Body ── */}
      <div style={s.body}>
        <div style={s.card}>

          {step === 1 ? (
            <>
              <h2 style={s.cardTitle}>Personal Information</h2>
              <p style={s.cardSub}>Enter your details exactly as they appear on your KYC documents.</p>

              <div style={s.grid2}>
                <Field label="Full Name *" name="fullName" value={form.fullName}
                  onChange={handleChange} placeholder="As per Aadhaar" />
                <Field label="Phone Number *" name="phone" type="tel" value={form.phone}
                  onChange={handleChange} placeholder="10-digit mobile" />
              </div>
              <Field label="Email Address *" name="email" type="email" value={form.email}
                onChange={handleChange} placeholder="your@email.com" />
              <Field label="KYC / Aadhaar Registered Address *" name="kycAddress"
                value={form.kycAddress} onChange={handleChange}
                placeholder="Full address as on Aadhaar" />
              <div style={s.grid2}>
                <Field label="Monthly Income (₹) *" name="statedIncome" type="number"
                  value={form.statedIncome} onChange={handleChange} placeholder="e.g. 50000" />
                <div>
                  <label style={s.label}>Loan Type *</label>
                  <select name="loanType" value={form.loanType} onChange={handleChange}
                    className="pf-input"
                    style={{ ...s.input, color: form.loanType ? "#111" : "#999" }}>
                    <option value="">Select loan type</option>
                    {LOAN_TYPES.map(lt => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <ErrorBox msg={error} />}
              <div style={s.btnRow}>
                <button className="pf-back" style={s.btnBack} onClick={onBack}>← Back</button>
                <button className="pf-primary" style={s.btnPrimary} onClick={handleNextStep}>
                  Next: Upload Documents →
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={s.cardTitle}>Upload Documents</h2>
              <p style={s.cardSub}>
                All four documents are required to complete your verification.
                Please have them ready before proceeding.
              </p>

              {/* Required badge */}
              <div style={s.reqBanner}>
                🔒 All documents are required for RBI V-CIP compliance and instant verification.
              </div>

              <UploadField
                label="Bank Statement PDF"
                accept=".pdf"
                file={bankStatement}
                onChange={setBankStatement}
                hint="Last 3–6 months · Password-protected supported"
                required
              />
              {bankStatement && (
                <Field
                  label="PDF Password (if protected)"
                  name="pdfPassword"
                  value={form.pdfPassword}
                  onChange={handleChange}
                  placeholder="Leave blank if not password-protected"
                />
              )}

              <div style={s.grid2}>
                <UploadField
                  label="KYC / Selfie Photo"
                  accept="image/*"
                  file={kycPhoto}
                  onChange={setKycPhoto}
                  hint="Clear front-facing photo"
                  required
                />
                <UploadField
                  label="Aadhaar Card"
                  accept="image/*,.pdf"
                  file={aadhaarCard}
                  onChange={setAadhaarCard}
                  hint="Front side · Clearly readable"
                  required
                />
              </div>

              <UploadField
                label="PAN Card"
                accept="image/*,.pdf"
                file={panCard}
                onChange={setPanCard}
                hint="Clear scan or photo"
                required
              />

              {/* Upload progress */}
              {loading && uploadMsg && (
                <div style={s.uploadingRow}>
                  <div style={s.spinner} />
                  {uploadMsg}
                </div>
              )}

              {error && <ErrorBox msg={error} />}

              <div style={s.btnRow}>
                <button className="pf-back" style={s.btnBack}
                  onClick={() => { setStep(1); setError(null); }} disabled={loading}>
                  ← Back
                </button>
                <button
                  className="pf-primary"
                  style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Uploading…" : "Start Video KYC →"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={s.sidebar}>
          <SideCard title="📋 What happens next?">
            {["Documents analysed by AI (30 sec)", "Live video call with AI agent",
              "Instant personalised loan offer", "Digital approval — no paperwork"
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={s.sideNum}>{i + 1}</div>
                <span style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </SideCard>
          <SideCard title="📄 Documents needed">
            {[
              { icon: "🏦", t: "Bank statement (PDF, 3–6 months)" },
              { icon: "📸", t: "KYC / selfie photo" },
              { icon: "🪪", t: "Aadhaar card (front)" },
              { icon: "💳", t: "PAN card" },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>{d.icon}</span>
                <span style={{ fontSize: 12, color: "#555" }}>{d.t}</span>
              </div>
            ))}
          </SideCard>
          <SideCard title="🔒 Your data is safe">
            <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.6 }}>
              All documents are encrypted and stored securely in India as per RBI data localisation rules.
            </p>
          </SideCard>
          <SideCard title="📞 Need help?">
            <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.6 }}>
              Call us at <strong style={{ color: NAVY }}>1800-266-9090</strong><br />Mon–Sat · 9am to 6pm
            </p>
          </SideCard>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={s.footer}>
        <span>📹 Camera & mic used during video call</span>
        <span>🔒 Session recorded for RBI V-CIP compliance</span>
        <span>🛡️ Poonawalla Fincorp — RBI Registered NBFC</span>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: done ? "#22c55e" : active ? ORANGE : "#e8ecf0",
        color: done || active ? "#fff" : "#999",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
        border: active ? `2px solid ${ORANGE}` : "2px solid transparent",
        transition: "all 0.3s",
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 10, color: active ? ORANGE : "#999", fontWeight: active ? 700 : 400 }}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      <input className="pf-input" style={s.input} type={type}
        name={name} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function UploadField({ label, accept, file, onChange, hint, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>
        {label}
        {required && <span style={{ color: ORANGE, marginLeft: 2 }}>*</span>}
      </label>
      <label className="pf-file" style={{
        ...s.fileBox,
        borderColor: file ? "#22c55e" : "#dde2e8",
        background:  file ? "#f0fff4" : "#fafbfc",
      }}>
        <input type="file" accept={accept} style={{ display: "none" }}
          onChange={(e) => onChange(e.target.files[0] || null)} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{file ? "✅" : "📂"}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, color: file ? "#166534" : "#555", fontWeight: file ? 600 : 400 }}>
              {file ? file.name : "Click to upload"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#999" }}>{hint}</p>
          </div>
          {!file && (
            <span style={{ fontSize: 12, color: ORANGE, fontWeight: 600, flexShrink: 0 }}>
              Browse
            </span>
          )}
          {file && (
            <button
              onClick={(e) => { e.preventDefault(); onChange(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999", padding: "0 4px" }}
            >
              ✕
            </button>
          )}
        </div>
      </label>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: "rgba(232,80,10,0.07)", border: "1px solid rgba(232,80,10,0.25)",
      borderRadius: 8, padding: "10px 14px", fontSize: 13, color: ORANGE, marginBottom: 16,
    }}>
      ⚠️ {msg}
    </div>
  );
}

function SideCard({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "18px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 12px" }}>{title}</p>
      {children}
    </div>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: "100vh", background: BG,
    fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column",
  },
  topBar: {
    background: "#fff", borderBottom: "1px solid #e8ecf0",
    padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", top: 0, zIndex: 10,
  },
  brand:    { display: "flex", alignItems: "center", gap: 10 },
  stepRow:  { display: "flex", alignItems: "center", gap: 8 },
  stepLine: { width: 60, height: 2, background: "#e8ecf0" },
  body: {
    flex: 1, display: "flex", gap: 24, padding: "32px 28px",
    maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box", alignItems: "flex-start",
  },
  card: {
    flex: 1, background: "#fff", borderRadius: 16,
    padding: "32px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
  },
  cardTitle: { fontSize: 22, fontWeight: 700, color: "#111", margin: "0 0 6px" },
  cardSub:   { fontSize: 13, color: "#888", margin: "0 0 24px" },
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  label:     { fontSize: 12, color: "#555", display: "block", marginBottom: 5, fontWeight: 500 },
  input: {
    width: "100%", padding: "11px 13px", borderRadius: 8,
    border: "1px solid #dde2e8", background: "#fff", color: "#111",
    fontSize: 14, boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "'Segoe UI', sans-serif",
  },
  fileBox: {
    display: "block", padding: "12px 14px", borderRadius: 8,
    border: "1.5px dashed #dde2e8", cursor: "pointer", transition: "all 0.2s",
  },
  reqBanner: {
    background: "rgba(232,80,10,0.06)", border: "1px solid rgba(232,80,10,0.18)",
    borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#c14008",
    marginBottom: 20, fontWeight: 500,
  },
  uploadingRow: {
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, color: "#555", marginBottom: 12,
  },
  spinner: {
    width: 16, height: 16, borderRadius: "50%",
    border: "2px solid #ddd", borderTop: `2px solid ${ORANGE}`,
    animation: "spin 0.7s linear infinite", flexShrink: 0,
  },
  btnRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 },
  btnBack: {
    padding: "10px 20px", borderRadius: 8, border: "1px solid #dde2e8",
    background: "#fff", color: "#555", fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "background 0.2s", fontFamily: "'Segoe UI', sans-serif",
  },
  btnPrimary: {
    padding: "12px 28px", borderRadius: 8, border: "none",
    background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", transition: "all 0.2s", fontFamily: "'Segoe UI', sans-serif",
  },
  sidebar: { width: 260, flexShrink: 0 },
  sideNum: {
    width: 20, height: 20, borderRadius: "50%",
    background: "rgba(232,80,10,0.1)", border: "1px solid rgba(232,80,10,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 700, color: ORANGE, flexShrink: 0, marginTop: 1,
  },
  footer: {
    background: "#fff", borderTop: "1px solid #e8ecf0",
    padding: "12px 28px", display: "flex", gap: 24,
    justifyContent: "center", fontSize: 11, color: "#aaa",
  },
};
