// src/components/ErrorScreen.jsx — generic fallback error screen
const NAVY   = "#001840";
const ORANGE = "#1a56db";

export default function ErrorScreen({ message, onRetry, onHome }) {
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
          <div style={{ fontSize: 52, textAlign: "center", marginBottom: 16 }}>⚠️</div>
          <h1 style={s.title}>Something Went Wrong</h1>
          <p style={s.subtitle}>
            We encountered an unexpected error. Please try again or contact our support team.
          </p>
          {message && (
            <div style={s.errBox}>
              <code style={{ fontSize: 12, color: "#dc2626" }}>{message}</code>
            </div>
          )}
          <div style={s.btnRow}>
            {onRetry && (
              <button style={s.btnPrimary} onClick={onRetry}>🔄 Try Again</button>
            )}
            {onHome && (
              <button style={s.btnSecondary} onClick={onHome}>← Go Home</button>
            )}
          </div>
          <div style={s.support}>
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              📞 Support:{" "}
              <a href="tel:18002669090" style={{ color: ORANGE, textDecoration: "none", fontWeight: 600 }}>
                1800-266-9090
              </a>
              {" "}· Mon–Sat 9am–6pm
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  topBar:  { background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "14px 28px" },
  body:    { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  card:    { background: "#fff", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 440, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" },
  title:   { fontSize: 24, fontWeight: 700, color: "#111", margin: "0 0 10px" },
  subtitle:{ color: "#888", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" },
  errBox:  { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", marginBottom: 24, textAlign: "left" },
  btnRow:  { display: "flex", gap: 12, marginBottom: 20 },
  btnPrimary:  { flex: 1, padding: 14, borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  btnSecondary:{ flex: 1, padding: 14, borderRadius: 10, border: "1px solid #e8ecf0", background: "#fff", color: "#555", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  support: { background: "#f5f7fa", borderRadius: 10, padding: "12px 16px" },
};
