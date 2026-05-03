// src/components/AuthPage.jsx
// Login / Sign Up page — frontend only, no backend yet
// Poonawalla Fincorp navy + orange brand theme
import { useState } from "react";

export default function AuthPage({ onAuth }) {
  const [mode, setMode]         = useState("login"); // "login" | "signup"
  const [form, setForm]         = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = () => {
    setError(null);

    // Basic validation
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup") {
      if (!form.name || !form.phone) {
        setError("Please fill all fields.");
        return;
      }
      if (form.password !== form.confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (form.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    // Simulate auth — replace with real API call when backend is ready
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuth({ email: form.email, name: form.name || form.email.split("@")[0] });
    }, 900);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .auth-input:focus { border-color: #E8500A !important; outline: none; }
        .auth-tab:hover   { color: #fff !important; }
        .auth-btn:hover   { background: #c7420a !important; transform: translateY(-1px); }
        .social-btn:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* Left panel — branding */}
      <div style={s.leftPanel}>
        <div style={s.leftInner}>
          <div style={s.brandMark}>
            <span style={s.brandIcon}>🏦</span>
          </div>
          <h1 style={s.brandName}>Poonawalla<br />Fincorp</h1>
          <p style={s.brandTagline}>
            India's most trusted NBFC — now with AI-powered instant loan onboarding.
          </p>

          <div style={s.featureList}>
            {[
              { icon: "⚡", text: "Loan approval in under 60 seconds" },
              { icon: "🎥", text: "Video KYC — no branch visit needed" },
              { icon: "🛡️", text: "RBI V-CIP compliant & fully secure" },
              { icon: "🤖", text: "10 AI agents working in parallel" },
            ].map((f, i) => (
              <div key={i} style={s.featureItem}>
                <span style={s.featureIcon}>{f.icon}</span>
                <span style={s.featureText}>{f.text}</span>
              </div>
            ))}
          </div>

          <div style={s.trustBadges}>
            <span style={s.badge}>AAA Rated</span>
            <span style={s.badge}>RBI Regulated</span>
            <span style={s.badge}>₹5Cr+ Max Loan</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={s.rightPanel}>
        <div style={s.formCard}>
          {/* Tabs */}
          <div style={s.tabs}>
            <button
              className="auth-tab"
              style={{ ...s.tab, ...(mode === "login" ? s.tabActive : s.tabInactive) }}
              onClick={() => { setMode("login"); setError(null); }}
            >
              Sign In
            </button>
            <button
              className="auth-tab"
              style={{ ...s.tab, ...(mode === "signup" ? s.tabActive : s.tabInactive) }}
              onClick={() => { setMode("signup"); setError(null); }}
            >
              Create Account
            </button>
          </div>

          <h2 style={s.formTitle}>
            {mode === "login" ? "Welcome back" : "Start your loan journey"}
          </h2>
          <p style={s.formSubtitle}>
            {mode === "login"
              ? "Sign in to continue your loan application"
              : "Create your account to apply for a loan in minutes"}
          </p>

          {/* Fields */}
          <div style={s.fields} onKeyDown={handleKeyDown}>
            {mode === "signup" && (
              <Field label="Full Name (as per Aadhaar)" name="name"
                value={form.name} onChange={handleChange} icon="👤" />
            )}
            <Field label="Email Address" name="email" type="email"
              value={form.email} onChange={handleChange} icon="✉️" />
            {mode === "signup" && (
              <Field label="Phone Number" name="phone" type="tel"
                value={form.phone} onChange={handleChange} icon="📱" />
            )}
            <Field
              label="Password"
              name="password"
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              icon="🔒"
              suffix={
                <button style={s.eyeBtn} onClick={() => setShowPass(v => !v)}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              }
            />
            {mode === "signup" && (
              <Field label="Confirm Password" name="confirm" type="password"
                value={form.confirm} onChange={handleChange} icon="🔒" />
            )}
          </div>

          {mode === "login" && (
            <div style={s.forgotRow}>
              <button style={s.forgotBtn}>Forgot password?</button>
            </div>
          )}

          {error && <div style={s.errorBox}>⚠️ {error}</div>}

          <button
            className="auth-btn"
            style={{ ...s.submitBtn, opacity: loading ? 0.75 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <span style={s.spinner} />
              : mode === "login"
              ? "Sign In →"
              : "Create Account →"}
          </button>

          {/* Divider */}
          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>or continue with</span>
            <div style={s.dividerLine} />
          </div>

          {/* Social */}
          <div style={s.socialRow}>
            <button className="social-btn" style={s.socialBtn}>
              <span>G</span> Google
            </button>
            <button className="social-btn" style={s.socialBtn}>
              <span>𝕏</span> X / Twitter
            </button>
          </div>

          <p style={s.termsText}>
            By continuing, you agree to Poonawalla Fincorp's{" "}
            <span style={s.link}>Terms of Service</span> and{" "}
            <span style={s.link}>Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, icon, suffix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={fStyle.label}>{label}</label>
      <div style={fStyle.inputWrap}>
        {icon && <span style={fStyle.icon}>{icon}</span>}
        <input
          className="auth-input"
          style={{ ...fStyle.input, paddingLeft: icon ? 40 : 14, paddingRight: suffix ? 40 : 14 }}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={label}
          autoComplete={type === "password" ? "current-password" : "on"}
        />
        {suffix && <div style={fStyle.suffix}>{suffix}</div>}
      </div>
    </div>
  );
}

const fStyle = {
  label:     { fontSize: 12, color: "#8899aa", display: "block", marginBottom: 5 },
  inputWrap: { position: "relative" },
  icon:      { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" },
  suffix:    { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" },
  input: {
    width:        "100%",
    padding:      "11px 14px",
    borderRadius: 9,
    border:       "1px solid rgba(255,255,255,0.1)",
    background:   "rgba(255,255,255,0.05)",
    color:        "#fff",
    fontSize:     14,
    boxSizing:    "border-box",
    transition:   "border-color 0.2s",
    fontFamily:   "'Segoe UI', sans-serif",
  },
};

const NAVY   = "#001840";
const ORANGE = "#E8500A";

const s = {
  page: {
    minHeight:     "100vh",
    display:       "flex",
    fontFamily:    "'Segoe UI', sans-serif",
    background:    "#f0f4f8",
  },

  // Left branding panel
  leftPanel: {
    flex:           "0 0 420px",
    background:     `linear-gradient(160deg, #001230 0%, ${NAVY} 60%, #002050 100%)`,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        48,
    position:       "relative",
    overflow:       "hidden",
  },
  leftInner: {
    position:  "relative",
    zIndex:    1,
    animation: "fadeUp 0.6s ease both",
  },
  brandMark: {
    width:          64,
    height:         64,
    borderRadius:   16,
    background:     `rgba(232,80,10,0.15)`,
    border:         `1px solid rgba(232,80,10,0.3)`,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   20,
  },
  brandIcon:    { fontSize: 30 },
  brandName: {
    fontSize:     32,
    fontWeight:   700,
    color:        "#fff",
    lineHeight:   1.15,
    margin:       "0 0 14px",
    letterSpacing:"-0.02em",
  },
  brandTagline: {
    color:      "rgba(255,255,255,0.55)",
    fontSize:   14,
    lineHeight: 1.7,
    margin:     "0 0 32px",
  },
  featureList: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 },
  featureItem: { display: "flex", alignItems: "center", gap: 12 },
  featureIcon: { fontSize: 18, flexShrink: 0 },
  featureText: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.4 },
  trustBadges: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    background:   "rgba(232,80,10,0.15)",
    border:       "1px solid rgba(232,80,10,0.3)",
    borderRadius: 99,
    padding:      "4px 12px",
    fontSize:     11,
    color:        "#ffb08a",
    fontWeight:   600,
  },

  // Right form panel
  rightPanel: {
    flex:           1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        24,
    background:     "#f0f4f8",
  },
  formCard: {
    background:   "#fff",
    borderRadius: 20,
    padding:      "40px 36px",
    width:        "100%",
    maxWidth:     440,
    boxShadow:    "0 4px 40px rgba(0,0,0,0.08)",
    animation:    "fadeUp 0.5s ease 0.1s both",
  },

  tabs: {
    display:      "flex",
    background:   "#f5f7fa",
    borderRadius: 10,
    padding:      4,
    marginBottom: 28,
  },
  tab: {
    flex:         1,
    padding:      "9px 0",
    borderRadius: 8,
    border:       "none",
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
    transition:   "all 0.2s",
    fontFamily:   "'Segoe UI', sans-serif",
  },
  tabActive:  { background: "#fff", color: ORANGE, boxShadow: "0 1px 6px rgba(0,0,0,0.08)" },
  tabInactive:{ background: "transparent", color: "#999" },

  formTitle:    { fontSize: 22, fontWeight: 700, color: "#111", margin: "0 0 6px" },
  formSubtitle: { fontSize: 13, color: "#888", margin: "0 0 24px", lineHeight: 1.5 },

  fields: { display: "flex", flexDirection: "column" },

  forgotRow: { display: "flex", justifyContent: "flex-end", marginBottom: 16, marginTop: -6 },
  forgotBtn: {
    background: "none", border: "none",
    color:      ORANGE, fontSize: 12,
    cursor:     "pointer", padding: 0,
    fontFamily: "'Segoe UI', sans-serif",
  },
  eyeBtn: {
    background: "none", border: "none",
    cursor:     "pointer", fontSize: 14,
    padding:    "2px 4px",
  },

  errorBox: {
    background:   "rgba(232,80,10,0.07)",
    border:       "1px solid rgba(232,80,10,0.2)",
    borderRadius: 8,
    padding:      "10px 14px",
    fontSize:     13,
    color:        ORANGE,
    marginBottom: 14,
  },

  submitBtn: {
    width:        "100%",
    padding:      14,
    borderRadius: 10,
    border:       "none",
    background:   ORANGE,
    color:        "#fff",
    fontSize:     15,
    fontWeight:   700,
    cursor:       "pointer",
    marginBottom: 20,
    transition:   "all 0.2s",
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    fontFamily:   "'Segoe UI', sans-serif",
  },
  spinner: {
    width:        18,
    height:       18,
    borderRadius: "50%",
    border:       "2px solid rgba(255,255,255,0.3)",
    borderTop:    "2px solid #fff",
    animation:    "spin 0.7s linear infinite",
    display:      "inline-block",
  },

  divider: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, background: "#eee" },
  dividerText: { fontSize: 12, color: "#bbb", whiteSpace: "nowrap" },

  socialRow: { display: "flex", gap: 10, marginBottom: 20 },
  socialBtn: {
    flex:         1,
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    gap:          8,
    padding:      "10px 0",
    borderRadius: 9,
    border:       "1px solid #e8ecf0",
    background:   "#fff",
    fontSize:     13,
    fontWeight:   600,
    color:        "#444",
    cursor:       "pointer",
    transition:   "background 0.2s",
    fontFamily:   "'Segoe UI', sans-serif",
  },

  termsText: { fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.6, margin: 0 },
  link:      { color: ORANGE, cursor: "pointer" },
};
