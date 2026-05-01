// src/components/LoanOffer.jsx
// Final screen shown after the call — displays loan offer or rejection
export default function LoanOffer({ result }) {
  const approved = result?.status === "approved";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>{approved ? "🎉" : "❌"}</div>
        <h1 style={styles.title}>
          {approved ? "Loan Offer Ready!" : "Application Not Approved"}
        </h1>

        {approved ? (
          <>
            <p style={styles.subtitle}>Congratulations! Here is your personalised loan offer.</p>

            <div style={styles.offerGrid}>
              <OfferItem label="Loan Amount"     value={`₹${result.amount?.toLocaleString("en-IN")}`} />
              <OfferItem label="Interest Rate"   value={`${result.interest_rate}% p.a.`} />
              <OfferItem label="Tenure"          value={`${result.tenure_months} months`} />
              <OfferItem label="Monthly EMI"     value={`₹${result.emi?.toLocaleString("en-IN")}`} />
              <OfferItem label="Product"         value={result.product_type || "Personal Loan"} />
              <OfferItem label="Risk Score"      value={`${result.risk_score} / 100`} />
            </div>

            <button style={styles.btn}>✅ Accept Offer</button>
            <button style={{ ...styles.btn, background: "transparent", border: "1px solid #444", marginTop: 8 }}>
              📄 Download Offer Letter
            </button>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>
              We were unable to approve your application at this time.
            </p>
            {result?.reason && (
              <div style={styles.reasonBox}>
                <p style={{ color: "#ff6b6b", margin: 0 }}>{result.reason}</p>
              </div>
            )}
            <p style={{ color: "#888", fontSize: 13, marginTop: 24 }}>
              You may re-apply after 30 days or contact our support team for assistance.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function OfferItem({ label, value }) {
  return (
    <div style={{
      background:   "rgba(255,255,255,0.05)",
      borderRadius: 12,
      padding:      "16px 20px",
    }}>
      <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>{value}</p>
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
    maxWidth:       540,
    backdropFilter: "blur(16px)",
    color:          "#fff",
    textAlign:      "center",
  },
  icon:     { fontSize: 56, marginBottom: 12 },
  title:    { fontSize: 28, fontWeight: 700, margin: "0 0 8px" },
  subtitle: { color: "#aaa", marginBottom: 28 },
  offerGrid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 12,
    marginBottom:        28,
    textAlign:           "left",
  },
  btn: {
    width:        "100%",
    padding:      14,
    borderRadius: 10,
    border:       "none",
    background:   "linear-gradient(90deg, #6c63ff, #48cae4)",
    color:        "#fff",
    fontSize:     16,
    fontWeight:   700,
    cursor:       "pointer",
    display:      "block",
  },
  reasonBox: {
    background:   "rgba(255,100,100,0.1)",
    border:       "1px solid rgba(255,100,100,0.3)",
    borderRadius: 10,
    padding:      16,
    marginTop:    16,
  },
};
