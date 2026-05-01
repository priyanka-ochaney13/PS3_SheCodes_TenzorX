// src/components/PreCallForm.jsx
// Customer fills in basic details before the video call starts
import { useState } from "react";
import api from "../services/api";

export default function PreCallForm({ onStartCall }) {
  const [form, setForm] = useState({
    fullName:     "",
    phone:        "",
    email:        "",
    kycAddress:   "",
    statedIncome: "",
    pdfPassword:  "",   // ← new
    loanType:     "",   // ← new
  });
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.kycAddress || !form.statedIncome || !form.loanType || !file) {
      setError("Please fill all fields, select a loan type, and upload your bank statement.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      formData.append("bank_statement", file);

      const res = await api.post("/session/create", formData);
      onStartCall({
        sessionId:    res.data.session_id,
        kycAddress:   form.kycAddress,
        statedIncome: parseInt(form.statedIncome),
        loanType:     form.loanType,
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start session. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🏦</div>
        <h1 style={styles.title}>Loan Onboarding</h1>
        <p style={styles.subtitle}>Poonawalla Fincorp · Video KYC</p>

        <div style={styles.form}>
          <Field label="Full Name (as per Aadhaar)"
            name="fullName" value={form.fullName} onChange={handleChange} />
          <Field label="Phone Number"
            name="phone" value={form.phone} onChange={handleChange} type="tel" />
          <Field label="Email Address"
            name="email" value={form.email} onChange={handleChange} type="email" />
          <Field label="Registered Address (KYC Address)"
            name="kycAddress" value={form.kycAddress} onChange={handleChange} />
          <Field label="Monthly Income (₹)"
            name="statedIncome" value={form.statedIncome} onChange={handleChange} type="number" />

          {/* ← NEW — Loan Type Dropdown */}
          <div style={{ marginBottom: 16 }}>
            <label style={styles.fieldLabel}>Loan Type</label>
            <select
              name="loanType"
              value={form.loanType}
              onChange={handleChange}
              style={{
                ...styles.input,
                color: form.loanType ? "#fff" : "#888",
              }}
            >
              <option value="" style={{ background: "#1a1a2e" }}>Select loan type</option>
              <option value="personal_loan_salaried"      style={{ background: "#1a1a2e" }}>Personal Loan — Salaried</option>
              <option value="personal_loan_self_employed" style={{ background: "#1a1a2e" }}>Personal Loan — Self Employed</option>
              <option value="business_loan"               style={{ background: "#1a1a2e" }}>Business Loan</option>
              <option value="professional_loan"           style={{ background: "#1a1a2e" }}>Professional Loan</option>
              <option value="lap"                         style={{ background: "#1a1a2e" }}>Loan Against Property</option>
            </select>
          </div>

          {/* ← NEW — PDF Password Field */}
          <Field label="Bank Statement Password (if password protected)"
            name="pdfPassword" value={form.pdfPassword} onChange={handleChange} />

          <label style={styles.fileLabel}>
            Bank Statement (PDF)
            <input
              type="file"
              accept=".pdf"
              style={styles.fileInput}
              onChange={(e) => setFile(e.target.files[0])}
            />
            <div style={styles.fileBox}>
              {file ? `✅ ${file.name}` : "Click to upload PDF"}
            </div>
          </label>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Starting..." : "Start Video KYC →"}
        </button>

        <p style={styles.note}>
          📹 Your camera and microphone will be used during the call.<br />
          🔒 This session is recorded for RBI V-CIP compliance.
        </p>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.fieldLabel}>{label}</label>
      <input
        style={styles.input}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={label}
      />
    </div>
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
    border:         "1px solid rgba(255,255,255,0.12)",
    borderRadius:   20,
    padding:        40,
    width:          "100%",
    maxWidth:       480,
    backdropFilter: "blur(16px)",
    color:          "#fff",
  },
  logo:     { fontSize: 40, textAlign: "center", marginBottom: 8 },
  title:    { fontSize: 28, fontWeight: 700, textAlign: "center", margin: 0 },
  subtitle: { textAlign: "center", color: "#aaa", marginBottom: 32, marginTop: 4 },
  form:     { display: "flex", flexDirection: "column" },
  fieldLabel: { fontSize: 12, color: "#aaa", marginBottom: 4, display: "block" },
  input: {
    width:        "100%",
    padding:      "10px 14px",
    borderRadius: 8,
    border:       "1px solid rgba(255,255,255,0.15)",
    background:   "rgba(255,255,255,0.07)",
    color:        "#fff",
    fontSize:     14,
    outline:      "none",
    boxSizing:    "border-box",
  },
  fileLabel: { cursor: "pointer", display: "block", marginBottom: 16 },
  fileInput: { display: "none" },
  fileBox: {
    padding:      "10px 14px",
    borderRadius: 8,
    border:       "1px dashed rgba(255,255,255,0.25)",
    color:        "#ccc",
    fontSize:     13,
    textAlign:    "center",
    marginTop:    4,
  },
  btn: {
    width:        "100%",
    padding:      "14px",
    borderRadius: 10,
    border:       "none",
    background:   "linear-gradient(90deg, #6c63ff, #48cae4)",
    color:        "#fff",
    fontSize:     16,
    fontWeight:   700,
    cursor:       "pointer",
    marginTop:    8,
    marginBottom: 16,
  },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 8 },
  note:  { color: "#888", fontSize: 12, textAlign: "center", lineHeight: 1.6 },
};