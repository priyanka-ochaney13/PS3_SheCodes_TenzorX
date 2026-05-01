// src/components/FraudRejected.jsx
// Shown when fraud pre-screen returns RED verdict
export default function FraudRejected({ signals = [], weight = null, onTryAgain }) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.iconWrap}>
          <span style={{ fontSize: 48 }}>🚫</span>
        </div>

        <h1 style={styles.title}>Application Could Not Proceed</h1>
        <p style={styles.subtitle}>
          Our automated security checks flagged your application before the video call.
          We are unable to continue with this session.
        </p>

        {/* Fraud signals */}
        {signals && signals.length > 0 && (
          <div style={styles.signalsBox}>
            <p style={styles.signalsTitle}>⚠️ Flags Raised</p>
            <ul style={styles.signalsList}>
              {signals.map((sig, i) => (
                <li key={i} style={styles.signalItem}>
                  <span style={styles.dot} />
                  {sig}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk weight if available */}
        {weight !== null && (
          <div style={styles.weightRow}>
            <span style={{ color: "#aaa", fontSize: 13 }}>Fraud Risk Weight</span>
            <span style={{
              ...styles.weightBadge,
              background: weight > 0.7 ? "rgba(255,70,70,0.15)"  :
                          weight > 0.4 ? "rgba(255,165,0,0.15)"  :
                                         "rgba(255,255,255,0.05)",
              color:      weight > 0.7 ? "#ff6b6b"  :
                          weight > 0.4 ? "#ffb347"  :
                                         "#aaa",
            }}>
              {Math.round(weight * 100)} / 100
            </span>
          </div>
        )}

        {/* What to do next */}
        <div style={styles.nextSteps}>
          <p style={styles.nextTitle}>What you can do</p>
          <div style={styles.stepItem}>
            <span style={styles.stepNum}>1</span>
            <p style={styles.stepText}>
              Ensure your bank statement is an original, unmodified PDF directly downloaded from your bank's portal or email.
            </p>
          </div>
          <div style={styles.stepItem}>
            <span style={styles.stepNum}>2</span>
            <p style={styles.stepText}>
              If you believe this is an error, contact our support team with your session reference number.
            </p>
          </div>
          <div style={styles.stepItem}>
            <span style={styles.stepNum}>3</span>
            <p style={styles.stepText}>
              You may re-apply after 30 days. Repeated failed attempts may affect your credit profile.
            </p>
          </div>
        </div>

        {/* Support */}
        <div style={styles.supportBox}>
          <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
            📞 Support:{" "}
            <a href="tel:18001033" style={{ color: "#48cae4", textDecoration: "none" }}>
              1800 103 3 (Toll Free)
            </a>
          </p>
          <p style={{ margin: "4px 0 0", color: "#555", fontSize: 12 }}>
            Mon–Sat, 9 AM – 7 PM
          </p>
        </div>

        <button style={styles.btn} onClick={onTryAgain}>
          ← Start a New Application
        </button>
      </div>
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
    background:     "rgba(255,255,255,0.04)",
    border:         "1px solid rgba(255,100,100,0.2)",
    borderRadius:   24,
    padding:        "40px 36px",
    width:          "100%",
    maxWidth:       520,
    backdropFilter: "blur(20px)",
    color:          "#fff",
  },
  iconWrap: {
    textAlign:    "center",
    marginBottom: 16,
  },
  title: {
    fontSize:   26,
    fontWeight: 700,
    textAlign:  "center",
    margin:     "0 0 10px",
    color:      "#fff",
  },
  subtitle: {
    color:      "#aaa",
    fontSize:   14,
    textAlign:  "center",
    lineHeight: 1.6,
    margin:     "0 0 24px",
  },
  signalsBox: {
    background:   "rgba(255,70,70,0.07)",
    border:       "1px solid rgba(255,70,70,0.2)",
    borderRadius: 12,
    padding:      "16px 20px",
    marginBottom: 20,
  },
  signalsTitle: {
    margin:     "0 0 10px",
    fontWeight: 600,
    fontSize:   13,
    color:      "#ff8888",
  },
  signalsList: {
    margin:    0,
    padding:   0,
    listStyle: "none",
  },
  signalItem: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    color:      "#ddd",
    fontSize:   13,
    marginBottom: 6,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: "50%",
    background:   "#ff6b6b",
    flexShrink:   0,
  },
  weightRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "12px 0",
    borderTop:      "1px solid rgba(255,255,255,0.07)",
    borderBottom:   "1px solid rgba(255,255,255,0.07)",
    marginBottom:   24,
  },
  weightBadge: {
    padding:      "4px 12px",
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   600,
  },
  nextSteps: {
    marginBottom: 24,
  },
  nextTitle: {
    fontSize:     13,
    fontWeight:   600,
    color:        "#aaa",
    margin:       "0 0 14px",
    textTransform:"uppercase",
    letterSpacing:"0.5px",
  },
  stepItem: {
    display:    "flex",
    gap:        14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  stepNum: {
    width:          24,
    height:         24,
    background:     "rgba(255,255,255,0.08)",
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       12,
    fontWeight:     700,
    flexShrink:     0,
    color:          "#aaa",
    lineHeight:     "24px",
    textAlign:      "center",
  },
  stepText: {
    margin:     0,
    fontSize:   13,
    color:      "#aaa",
    lineHeight: 1.6,
  },
  supportBox: {
    background:   "rgba(255,255,255,0.04)",
    border:       "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding:      "14px 18px",
    marginBottom: 24,
    textAlign:    "center",
  },
  btn: {
    width:        "100%",
    padding:      14,
    borderRadius: 10,
    border:       "1px solid rgba(255,255,255,0.15)",
    background:   "transparent",
    color:        "#ccc",
    fontSize:     15,
    fontWeight:   600,
    cursor:       "pointer",
  },
};
