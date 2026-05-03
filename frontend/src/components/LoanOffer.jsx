// src/components/LoanOffer.jsx — Poonawalla navy + orange, with EMI breakdown
const NAVY   = "#001840";
const ORANGE = "#1a56db";

export default function LoanOffer({ result, onStartNew }) {
  const approved = result?.status === "approved";

  // EMI calculation (flat reducing balance)
  const calcEMI = (principal, ratePA, months) => {
    if (!principal || !ratePA || !months) return null;
    const r = ratePA / 12 / 100;
    return Math.round((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
  };

  const emi        = result?.emi || calcEMI(result?.amount, result?.interest_rate, result?.tenure_months);
  const totalPay   = emi && result?.tenure_months ? emi * result.tenure_months : null;
  const totalInt   = totalPay && result?.amount ? totalPay - result.amount : null;

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Poonawalla Fincorp</span>
        </div>
        {approved && (
          <span style={s.approvedBadge}>✅ Application Approved</span>
        )}
      </div>

      <div style={s.body}>
        <div style={s.card}>
          {approved ? (
            <>
              {/* Hero */}
              <div style={s.heroBlock}>
                <div style={s.confettiIcon}>🎉</div>
                <h1 style={s.title}>Congratulations!</h1>
                <p style={s.subtitle}>Your personalised loan offer is ready. Review the details below.</p>
              </div>

              {/* Main offer card */}
              <div style={s.offerHighlight}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Loan Amount Approved
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
                    ₹{result.amount?.toLocaleString("en-IN")}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                    {result.product_type || "Personal Loan"} · {result.tenure_months} months
                  </p>
                </div>

                {/* Key metrics row */}
                <div style={s.metricsRow}>
                  <Metric label="Interest Rate" value={`${result.interest_rate}% p.a.`} light />
                  <div style={s.metricDivider} />
                  <Metric label="Monthly EMI" value={emi ? `₹${emi.toLocaleString("en-IN")}` : "—"} light />
                  <div style={s.metricDivider} />
                  <Metric label="Risk Score" value={`${result.risk_score}/100`} light />
                </div>
              </div>

              {/* EMI Breakdown */}
              {emi && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>💳 EMI Breakdown</h3>
                  <div style={s.breakdownTable}>
                    <BRow label="Principal Amount"    value={`₹${result.amount?.toLocaleString("en-IN")}`} />
                    <BRow label="Interest Rate"       value={`${result.interest_rate}% per annum`} />
                    <BRow label="Loan Tenure"         value={`${result.tenure_months} months`} />
                    <BRow label="Monthly EMI"         value={emi ? `₹${emi.toLocaleString("en-IN")}` : "—"} highlight />
                    {totalInt && <BRow label="Total Interest Payable" value={`₹${totalInt.toLocaleString("en-IN")}`} />}
                    {totalPay && <BRow label="Total Amount Payable"   value={`₹${totalPay.toLocaleString("en-IN")}`} bold />}
                  </div>
                </div>
              )}

              {/* Key terms */}
              <div style={s.section}>
                <h3 style={s.sectionTitle}>📋 Key Terms</h3>
                <div style={s.termsGrid}>
                  {[
                    { k: "Processing Fee", v: "Up to 2% of loan amount" },
                    { k: "Prepayment",     v: "Allowed after 6 months" },
                    { k: "Disbursement",   v: "Within 24–48 hours of approval" },
                    { k: "Repayment Mode", v: "Auto-debit (NACH mandate)" },
                  ].map((t, i) => (
                    <div key={i} style={s.termItem}>
                      <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>{t.k}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 500, color: "#333" }}>{t.v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div style={s.ctaRow}>
                <button style={s.btnPrimary}>✅ Accept Offer</button>
                <button style={s.btnSecondary}>📄 Download Letter</button>
              </div>

              <p style={s.disclaimer}>
                *This is a pre-approved indicative offer. Final offer subject to document verification
                and credit check. Interest rates may vary. Poonawalla Fincorp — RBI Registered NBFC.
              </p>
            </>
          ) : (
            <>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
                <h1 style={{ ...s.title, marginBottom: 10 }}>Application Not Approved</h1>
                <p style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  We were unable to approve your application at this time.
                </p>
                {result?.reason && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", marginBottom: 24 }}>
                    <p style={{ margin: 0, color: "#dc2626", fontSize: 13 }}>{result.reason}</p>
                  </div>
                )}
                <div style={{ background: "#f5f7fa", borderRadius: 12, padding: "20px", textAlign: "left", marginBottom: 24 }}>
                  <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 13, color: "#555" }}>What you can do next</p>
                  {[
                    "Check your CIBIL score and resolve any negative entries",
                    "Reduce existing EMI obligations before re-applying",
                    "Contact our support team for personalised guidance",
                  ].map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                      <span style={{ color: ORANGE, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: "#666" }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "14px 18px", marginBottom: 24 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#1a56db" }}>
                    📞 Support: <a href="tel:18002669090" style={{ color: ORANGE, textDecoration: "none", fontWeight: 600 }}>1800-266-9090</a> · Mon–Sat 9am–6pm
                  </p>
                </div>
              </div>
            </>
          )}

          {onStartNew && (
            <button style={s.btnNew} onClick={onStartNew}>← Start a New Application</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, light }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <p style={{ margin: 0, fontSize: 11, color: light ? "rgba(255,255,255,0.6)" : "#aaa" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: light ? "#fff" : "#111" }}>{value}</p>
    </div>
  );
}

function BRow({ label, value, highlight, bold }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 14px", borderRadius: 8,
      background: highlight ? "rgba(26,86,219,0.06)" : "transparent",
      border: highlight ? "1px solid rgba(26,86,219,0.15)" : "1px solid transparent",
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 13, color: "#777" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: (highlight || bold) ? 700 : 500, color: highlight ? ORANGE : "#111" }}>{value}</span>
    </div>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  topBar:  { background: "#fff", borderBottom: "1px solid #e8ecf0", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  approvedBadge: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 99, padding: "5px 14px", fontSize: 12, fontWeight: 600 },
  body:    { flex: 1, display: "flex", justifyContent: "center", padding: "32px 24px" },
  card:    { background: "#fff", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 580, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", height: "fit-content" },
  heroBlock: { textAlign: "center", marginBottom: 28 },
  confettiIcon: { fontSize: 52, marginBottom: 12 },
  title:   { fontSize: 26, fontWeight: 700, color: "#111", margin: "0 0 6px" },
  subtitle:{ fontSize: 14, color: "#888", margin: 0, lineHeight: 1.6 },
  offerHighlight: {
    background: `linear-gradient(135deg, ${NAVY} 0%, #003087 100%)`,
    borderRadius: 16, padding: "28px 24px", marginBottom: 24,
  },
  metricsRow:   { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 12px" },
  metricDivider:{ width: 1, height: 36, background: "rgba(255,255,255,0.15)", flexShrink: 0 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#111", margin: "0 0 12px" },
  breakdownTable: { background: "#fafbfc", borderRadius: 10, padding: "8px", border: "1px solid #f0f4f8" },
  termsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  termItem:  { background: "#f5f7fa", borderRadius: 10, padding: "12px 14px" },
  ctaRow:    { display: "flex", gap: 12, marginBottom: 20 },
  btnPrimary: { flex: 1, padding: 14, borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  btnSecondary: { flex: 1, padding: 14, borderRadius: 10, border: "1px solid #e8ecf0", background: "#fff", color: "#555", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  btnNew:  { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e8ecf0", background: "#fff", color: "#aaa", fontSize: 13, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  disclaimer: { fontSize: 10, color: "#ccc", lineHeight: 1.6, margin: 0 },
};
