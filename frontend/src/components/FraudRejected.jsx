// src/components/FraudRejected.jsx — Poonawalla navy+white theme
const NAVY   = "#001840";
const ORANGE = "#E8500A";

export default function FraudRejected({ signals = [], weight = null, onTryAgain }) {
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Poonawalla Fincorp</span>
        </div>
      </div>

      <div style={s.body}>
        <div style={s.card}>
          <div style={s.iconWrap}>🚫</div>
          <h1 style={s.title}>Application Could Not Proceed</h1>
          <p style={s.subtitle}>
            Our automated security checks flagged your application before the video call.
            We are unable to continue with this session.
          </p>

          {/* Signals */}
          {signals && signals.length > 0 && (
            <div style={s.signalsBox}>
              <p style={s.signalsTitle}>⚠️ Flags Raised</p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {signals.map((sig, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "#444" }}>{sig}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weight */}
          {weight !== null && (
            <div style={s.weightRow}>
              <span style={{ fontSize: 13, color: "#888" }}>Fraud Risk Score</span>
              <span style={{
                padding: "4px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: weight > 0.7 ? "#fef2f2" : weight > 0.4 ? "#fff7ed" : "#f5f7fa",
                color:      weight > 0.7 ? "#dc2626" : weight > 0.4 ? "#ea580c" : "#888",
                border:     weight > 0.7 ? "1px solid #fecaca" : weight > 0.4 ? "1px solid #fed7aa" : "1px solid #e8ecf0",
              }}>
                {Math.round(weight * 100)} / 100
              </span>
            </div>
          )}

          {/* Steps */}
          <div style={s.nextBox}>
            <p style={s.nextTitle}>What you can do</p>
            {[
              "Ensure your bank statement is an original, unmodified PDF downloaded directly from your bank portal.",
              "If you believe this is an error, contact our support team with your session reference number.",
              "You may re-apply after 30 days. Repeated failures may affect your credit profile.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={s.stepNum}>{i + 1}</div>
                <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.6 }}>{t}</p>
              </div>
            ))}
          </div>

          {/* Support */}
          <div style={s.supportBox}>
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              📞 Support:{" "}
              <a href="tel:18002669090" style={{ color: ORANGE, textDecoration: "none", fontWeight: 600 }}>
                1800-266-9090 (Toll Free)
              </a>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#aaa" }}>Mon–Sat, 9 AM – 6 PM</p>
          </div>

          <button style={s.btn} onClick={onTryAgain}>← Start a New Application</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  topBar:  { background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "14px 28px" },
  body:    { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    background: "#fff", borderRadius: 20, padding: "40px 36px",
    width: "100%", maxWidth: 520, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  iconWrap: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  title:    { fontSize: 24, fontWeight: 700, textAlign: "center", color: "#111", margin: "0 0 10px" },
  subtitle: { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 1.6, margin: "0 0 24px" },
  signalsBox: {
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 12, padding: "16px 20px", marginBottom: 20,
  },
  signalsTitle: { margin: "0 0 10px", fontWeight: 600, fontSize: 13, color: "#dc2626" },
  weightRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 0", borderTop: "1px solid #f0f4f8", borderBottom: "1px solid #f0f4f8", marginBottom: 24,
  },
  nextBox:  { marginBottom: 24 },
  nextTitle:{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 14px" },
  stepNum: {
    width: 24, height: 24, borderRadius: "50%",
    background: "#f5f7fa", border: "1px solid #e8ecf0",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: "#888", flexShrink: 0,
  },
  supportBox: {
    background: "#f5f7fa", border: "1px solid #e8ecf0",
    borderRadius: 10, padding: "14px 18px", marginBottom: 24, textAlign: "center",
  },
  btn: {
    width: "100%", padding: 14, borderRadius: 10, border: "1px solid #e8ecf0",
    background: "#fff", color: "#888", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Segoe UI', sans-serif",
  },
};
