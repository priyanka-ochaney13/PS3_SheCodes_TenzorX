// src/components/LandingPage.jsx — Poonawalla Fincorp full redesign
// Navy #001840, Orange #1a56db, White background
import { useState, useEffect } from "react";

const NAVY   = "#001840";
const NAVY2  = "#003087";
const ORANGE = "#1a56db";
const BG     = "#f0f4f8";

const LOAN_TYPES = [
  { icon: "💼", name: "Personal Loan",       rate: "From 9.99% p.a.",  max: "Up to ₹50L" },
  { icon: "🏢", name: "Business Loan",       rate: "From 11.5% p.a.", max: "Up to ₹50L" },
  { icon: "🩺", name: "Professional Loan",   rate: "From 10.5% p.a.", max: "Up to ₹50L" },
  { icon: "🏠", name: "Loan Against Property", rate: "From 8.75% p.a.", max: "Up to ₹2Cr" },
];

const STEPS = [
  { n: "01", icon: "📝", title: "Fill the Form",     desc: "Enter your basic details and upload your bank statement and KYC documents." },
  { n: "02", icon: "⚙️", title: "AI Verification",   desc: "Our 10 AI agents verify your income, detect fraud, and analyse your profile in seconds." },
  { n: "03", icon: "🎥", title: "Video Call",         desc: "A short 5-minute live video call for RBI V-CIP compliance — from your home." },
  { n: "04", icon: "⚡", title: "Instant Offer",      desc: "Receive a personalised loan offer with amount, rate, and EMI breakdown instantly." },
];

const STATS = [
  { value: "160M+",  label: "Loans Disbursed" },
  { value: "7M+",    label: "Happy Customers" },
  { value: "₹50L",   label: "Max Loan Amount" },
  { value: "AAA",    label: "Credit Rating" },
];

// ── EMI Calculator ──────────────────────────────────────────
function EMICalculator() {
  const [amount,  setAmount]  = useState(500000);
  const [rate,    setRate]    = useState(10.5);
  const [months,  setMonths]  = useState(36);

  const calcEMI = () => {
    const r = rate / 12 / 100;
    return Math.round((amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
  };
  const emi      = calcEMI();
  const totalPay = emi * months;
  const totalInt = totalPay - amount;

  return (
    <div style={calc.wrap}>
      <h3 style={calc.title}>EMI Calculator</h3>
      <p style={calc.sub}>Estimate your monthly payment instantly</p>

      <div style={calc.row}>
        <label style={calc.label}>Loan Amount: <strong style={{ color: ORANGE }}>₹{amount.toLocaleString("en-IN")}</strong></label>
        <input type="range" min={50000} max={5000000} step={50000} value={amount}
          onChange={(e) => setAmount(Number(e.target.value))} style={calc.range} />
        <div style={calc.rangeLabels}><span>₹50K</span><span>₹50L</span></div>
      </div>

      <div style={calc.row}>
        <label style={calc.label}>Interest Rate: <strong style={{ color: ORANGE }}>{rate}% p.a.</strong></label>
        <input type="range" min={8} max={24} step={0.5} value={rate}
          onChange={(e) => setRate(Number(e.target.value))} style={calc.range} />
        <div style={calc.rangeLabels}><span>8%</span><span>24%</span></div>
      </div>

      <div style={calc.row}>
        <label style={calc.label}>Tenure: <strong style={{ color: ORANGE }}>{months} months</strong></label>
        <input type="range" min={6} max={84} step={6} value={months}
          onChange={(e) => setMonths(Number(e.target.value))} style={calc.range} />
        <div style={calc.rangeLabels}><span>6 mo</span><span>84 mo</span></div>
      </div>

      <div style={calc.resultBox}>
        <div style={calc.emiDisplay}>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Monthly EMI</p>
          <p style={{ margin: "4px 0 0", fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            ₹{emi.toLocaleString("en-IN")}
          </p>
        </div>
        <div style={calc.resultDetails}>
          <div style={calc.resultRow}>
            <span>Principal</span>
            <span>₹{amount.toLocaleString("en-IN")}</span>
          </div>
          <div style={calc.resultRow}>
            <span>Total Interest</span>
            <span>₹{totalInt.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ ...calc.resultRow, fontWeight: 700, color: "#fff", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 4 }}>
            <span>Total Payable</span>
            <span>₹{totalPay.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const calc = {
  wrap:  { background: "#fff", borderRadius: 20, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", flex: "1 1 380px" },
  title: { fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 4px" },
  sub:   { fontSize: 13, color: "#888", margin: "0 0 24px" },
  row:   { marginBottom: 20 },
  label: { fontSize: 13, color: "#555", display: "block", marginBottom: 8 },
  range: { width: "100%", accentColor: ORANGE, cursor: "pointer" },
  rangeLabels: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#bbb", marginTop: 4 },
  resultBox: { background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`, borderRadius: 14, padding: "20px 20px", marginTop: 8 },
  emiDisplay: { textAlign: "center", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.12)" },
  resultDetails: { display: "flex", flexDirection: "column", gap: 8 },
  resultRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.65)" },
};

// ── Main component ──────────────────────────────────────────
export default function LandingPage({ user, onGetStarted, onLogout }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:.6;} 50%{opacity:1;} }
        .hero-cta:hover   { background: #1a56db !important; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(26,86,219,0.35) !important; }
        .lt-card:hover    { border-color: ${ORANGE} !important; transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
        .nav-link:hover   { color: ${ORANGE} !important; }
        .ghost-btn:hover  { background: rgba(255,255,255,0.12) !important; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={s.nav}>
        <div style={s.navBrand}>
          <div style={s.navLogo}>🏦</div>
          <div>
            <span style={s.navName}>Poonawalla Fincorp</span>
            <span style={s.navTag}>AI Video KYC Portal</span>
          </div>
        </div>
        <div style={s.navRight}>
          <a className="nav-link" href="https://poonawallafincorp.com" target="_blank" rel="noreferrer" style={s.navLink}>About</a>
          <a className="nav-link" href="tel:18002669090" style={s.navLink}>📞 1800-266-9090</a>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#555" }}>Hi, {user.name?.split(" ")[0]}!</span>
              <button onClick={onLogout} style={s.navLogout}>Logout</button>
            </div>
          ) : null}
          <button className="hero-cta" style={s.navCta} onClick={onGetStarted}>Apply Now</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        {/* Background pattern */}
        <div style={s.heroPattern} />

        <div style={{ ...s.heroInner, opacity: visible ? 1 : 0, transition: "opacity 0.5s" }}>
          <div style={s.heroBadge}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite", marginRight: 6 }} />
            RBI V-CIP Compliant · AI-Powered · Instant Decisions
          </div>

          <h1 style={s.heroTitle}>
            Get a Loan.<br />
            <span style={{ color: ORANGE }}>Instantly. Anywhere.</span>
          </h1>

          <p style={s.heroSubtitle}>
            India's most trusted NBFC now offers complete AI-powered loan onboarding
            via video call — no paperwork, no branch visits, approval in under 5 minutes.
          </p>

          <div style={s.heroButtons}>
            <button className="hero-cta" style={s.heroBtn} onClick={onGetStarted}>
              Apply Now — Free →
            </button>
            <button className="ghost-btn" style={s.heroGhost}>
              Watch Demo ▶
            </button>
          </div>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 12 }}>
            No credit score impact · No hidden fees · Cancel anytime
          </p>
        </div>

        {/* Hero visual card */}
        <div style={{ ...s.heroCard, animation: visible ? "fadeUp 0.6s ease 0.2s both" : "none" }}>
          <div style={s.heroCardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(26,86,219,0.2)", border: "1px solid rgba(26,86,219,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                🎥
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff" }}>Live Video KYC</p>
                <p style={{ margin: 0, fontSize: 11, color: "#4ade80" }}>● Session Active</p>
              </div>
            </div>
            <div style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "3px 10px", fontSize: 10, color: "#fca5a5", fontWeight: 600 }}>
              ⏺ REC
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {["Upload documents", "AI fraud check", "Video call", "Get offer"].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: i < 2 ? ORANGE : "rgba(255,255,255,0.08)",
                  border:     i < 2 ? "none" : "1px solid rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {i < 2 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 13, color: i < 2 ? "#fff" : "rgba(255,255,255,0.4)" }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(26,86,219,0.1)", border: "1px solid rgba(26,86,219,0.25)", borderRadius: 12, padding: "16px" }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Your Estimated Offer</p>
            <p style={{ margin: "4px 0 2px", fontSize: 28, fontWeight: 800, color: "#fff" }}>₹15,00,000</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>@ 10.5% p.a. · 36 months · ₹48,590/mo EMI</p>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={s.statsBar}>
        {STATS.map((stat, i) => (
          <div key={i} style={s.statItem}>
            <span style={s.statValue}>{stat.value}</span>
            <span style={s.statLabel}>{stat.label}</span>
            {i < STATS.length - 1 && <div style={s.statDivider} />}
          </div>
        ))}
      </div>

      {/* ── Loan Types ── */}
      <section style={s.section}>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>Loan Products</h2>
          <p style={s.sectionSub}>Tailored financing for every need — approved in minutes.</p>
        </div>
        <div style={s.loansGrid}>
          {LOAN_TYPES.map((l, i) => (
            <div key={i} className="lt-card" style={s.loanCard} onClick={onGetStarted}>
              <span style={{ fontSize: 32, marginBottom: 12, display: "block" }}>{l.icon}</span>
              <h3 style={s.loanName}>{l.name}</h3>
              <p style={s.loanRate}>{l.rate}</p>
              <p style={s.loanMax}>{l.max}</p>
              <div style={s.applyLink}>Apply Now →</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works + EMI Calculator ── */}
      <section style={{ ...s.section, background: "#f7f9fb", paddingTop: 60, paddingBottom: 60 }}>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>How It Works</h2>
          <p style={s.sectionSub}>From application to approved in 4 simple steps.</p>
        </div>

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap", maxWidth: 1100, margin: "0 auto" }}>
          {/* Steps */}
          <div style={{ flex: "1 1 340px" }}>
            {STEPS.map((step, i) => (
              <div key={i} style={s.stepItem}>
                <div style={s.stepLeft}>
                  <div style={s.stepNumBox}>{step.icon}</div>
                  {i < STEPS.length - 1 && <div style={s.stepConnector} />}
                </div>
                <div style={s.stepContent}>
                  <span style={s.stepN}>{step.n}</span>
                  <h3 style={s.stepT}>{step.title}</h3>
                  <p style={s.stepD}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* EMI Calculator */}
          <EMICalculator />
        </div>
      </section>

      {/* ── Trust Section ── */}
      <section style={s.section}>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>Why Choose Us?</h2>
          <p style={s.sectionSub}>India's fastest growing NBFC — trusted by millions.</p>
        </div>
        <div style={s.trustGrid}>
          {[
            { icon: "🤖", t: "10 AI Agents Working in Parallel",   d: "Speech, face, fraud, income, policy, geo — all verified simultaneously." },
            { icon: "🔒", t: "RBI V-CIP Compliant",                d: "Fully compliant with RBI's Video Customer Identification guidelines." },
            { icon: "⚡", t: "Decision in Under 5 Minutes",        d: "AI processes your entire application faster than any human could." },
            { icon: "🛡️", t: "Bank-Grade Security",                d: "256-bit encryption · Data stored in India · ISO 27001 certified." },
          ].map((f, i) => (
            <div key={i} style={s.trustCard}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 12 }}>{f.icon}</span>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>{f.t}</h3>
              <p style={{ fontSize: 13, color: "#888", margin: 0, lineHeight: 1.6 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={s.ctaBanner}>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", color: "#fff" }}>
          Ready to Apply?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, margin: "0 0 28px" }}>
          Your entire loan application in under 10 minutes.
        </p>
        <button className="hero-cta" style={{ ...s.heroBtn, margin: "0 auto", display: "block", maxWidth: 280 }}
          onClick={onGetStarted}>
          Start My Application →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerTop}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🏦</span>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>Poonawalla Fincorp</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: 0, maxWidth: 260, lineHeight: 1.6 }}>
              RBI Registered Non-Banking Financial Company. AAA rated.
            </p>
          </div>
          <div style={s.footerLinks}>
            <p style={s.footerLinkTitle}>Products</p>
            {["Personal Loan", "Business Loan", "Professional Loan", "Loan Against Property"].map((t) => (
              <p key={t} style={s.footerLink}>{t}</p>
            ))}
          </div>
          <div style={s.footerLinks}>
            <p style={s.footerLinkTitle}>Support</p>
            {["1800-266-9090", "care@poonawallafincorp.com", "Mon–Sat 9am–6pm"].map((t) => (
              <p key={t} style={s.footerLink}>{t}</p>
            ))}
          </div>
        </div>
        <div style={s.footerBottom}>
          <span>© 2024 Poonawalla Fincorp Limited. All rights reserved.</span>
          <span>NBFC regulated by RBI · CIN: U65910MH2005PLC268070</span>
          <span>Loans subject to credit assessment. T&C apply.</span>
        </div>
      </footer>
    </div>
  );
}

const s = {
  page:    { minHeight: "100vh", background: "#fff", fontFamily: "'Segoe UI', sans-serif", overflowX: "hidden" },

  // Nav
  nav: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 40px", background: "#fff",
    borderBottom: "1px solid #e8ecf0", position: "sticky", top: 0, zIndex: 50,
    boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10 },
  navLogo:  { width: 36, height: 36, background: NAVY, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  navName:  { display: "block", fontWeight: 700, fontSize: 15, color: NAVY },
  navTag:   { display: "block", fontSize: 10, color: "#aaa" },
  navRight: { display: "flex", alignItems: "center", gap: 20 },
  navLink:  { color: "#555", fontSize: 13, textDecoration: "none", transition: "color 0.2s" },
  navLogout:{ background: "none", border: "1px solid #e8ecf0", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#888", cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" },
  navCta:   { padding: "9px 22px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Segoe UI', sans-serif" },

  // Hero
  hero: {
    background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
    padding: "80px 40px 80px", display: "flex", gap: 48, alignItems: "center",
    position: "relative", overflow: "hidden", flexWrap: "wrap",
  },
  heroPattern: {
    position: "absolute", inset: 0, opacity: 0.04,
    backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
    backgroundSize: "32px 32px", pointerEvents: "none",
  },
  heroInner:   { flex: "1 1 420px", position: "relative", zIndex: 1 },
  heroBadge:   { display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 99, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, color: "rgba(255,255,255,0.75)", marginBottom: 24, letterSpacing: "0.3px" },
  heroTitle:   { fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-1.5px" },
  heroSubtitle:{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: 480, margin: "0 0 32px" },
  heroButtons: { display: "flex", gap: 14, flexWrap: "wrap" },
  heroBtn:     { padding: "14px 32px", borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Segoe UI', sans-serif", boxShadow: "0 8px 24px rgba(26,86,219,0.25)" },
  heroGhost:   { padding: "14px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Segoe UI', sans-serif" },
  heroCard:    { flex: "0 0 300px", background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, position: "relative", zIndex: 1 },
  heroCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" },

  // Stats
  statsBar: {
    display: "flex", justifyContent: "center", gap: 0,
    background: NAVY, padding: "20px 40px", flexWrap: "wrap",
  },
  statItem:    { display: "flex", alignItems: "center", gap: 24, padding: "0 32px", position: "relative" },
  statValue:   { display: "block", fontSize: 26, fontWeight: 800, color: ORANGE },
  statLabel:   { display: "block", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  statDivider: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 1, height: 32, background: "rgba(255,255,255,0.1)" },

  // Sections
  section:      { padding: "64px 40px", maxWidth: 1140, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  sectionHead:  { textAlign: "center", marginBottom: 48 },
  sectionTitle: { fontSize: 30, fontWeight: 800, color: NAVY, margin: "0 0 10px", letterSpacing: "-0.5px" },
  sectionSub:   { fontSize: 15, color: "#888", margin: 0 },

  // Loans
  loansGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  loanCard:  { background: "#fff", borderRadius: 16, padding: "28px 24px", border: "1.5px solid #e8ecf0", cursor: "pointer", transition: "all 0.25s" },
  loanName:  { fontWeight: 700, fontSize: 16, color: "#111", margin: "0 0 6px" },
  loanRate:  { color: ORANGE, fontSize: 14, fontWeight: 600, margin: "0 0 4px" },
  loanMax:   { color: "#aaa", fontSize: 12, margin: "0 0 16px" },
  applyLink: { fontSize: 13, fontWeight: 600, color: NAVY },

  // Steps
  stepItem:      { display: "flex", gap: 16, marginBottom: 0 },
  stepLeft:      { display: "flex", flexDirection: "column", alignItems: "center" },
  stepNumBox:    { width: 44, height: 44, borderRadius: 12, background: "rgba(26,86,219,0.08)", border: "1px solid rgba(26,86,219,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
  stepConnector: { width: 2, flex: 1, background: "#e8ecf0", minHeight: 28, margin: "6px 0" },
  stepContent:   { paddingBottom: 28 },
  stepN:         { fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: "0.5px", textTransform: "uppercase" },
  stepT:         { fontSize: 16, fontWeight: 700, color: "#111", margin: "4px 0 6px" },
  stepD:         { fontSize: 13, color: "#888", margin: 0, lineHeight: 1.6 },

  // Trust
  trustGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 },
  trustCard: { background: "#f5f7fa", borderRadius: 14, padding: "24px 20px", border: "1px solid #e8ecf0" },

  // CTA
  ctaBanner: { background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`, padding: "64px 40px", textAlign: "center" },

  // Footer
  footer:      { background: "#0a1020", padding: "48px 40px 24px" },
  footerTop:   { display: "flex", gap: 48, flexWrap: "wrap", marginBottom: 32, paddingBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  footerLinks: { minWidth: 160 },
  footerLinkTitle: { fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 12px" },
  footerLink:  { fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 8px", cursor: "pointer" },
  footerBottom:{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.2)" },
};
