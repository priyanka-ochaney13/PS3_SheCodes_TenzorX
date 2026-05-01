// src/components/LandingPage.jsx
// Branded landing page — Poonawalla Fincorp Video KYC Loan Onboarding
import { useState, useEffect } from "react";

const FEATURES = [
  {
    icon: "🎥",
    title: "Video KYC in Minutes",
    desc:  "Complete your full KYC verification via a live video call — no branch visit needed.",
  },
  {
    icon: "🔒",
    title: "RBI V-CIP Compliant",
    desc:  "Your session is recorded and compliant with RBI's Video Customer Identification Process.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Analysis",
    desc:  "Our AI agents verify your bank statements and income in real time for instant decisions.",
  },
  {
    icon: "⚡",
    title: "Instant Loan Offers",
    desc:  "Get a personalised loan offer within minutes of completing your video onboarding.",
  },
];

const LOAN_TYPES = [
  { name: "Personal Loan",       rate: "From 9.99% p.a.", icon: "💼" },
  { name: "Business Loan",       rate: "From 11.5% p.a.", icon: "🏢" },
  { name: "Professional Loan",   rate: "From 10.5% p.a.", icon: "🩺" },
  { name: "Loan Against Property", rate: "From 8.75% p.a.", icon: "🏠" },
];

export default function LandingPage({ onGetStarted }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={styles.page}>
      {/* Inject keyframes */}
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse    { 0%,100% { opacity:.7; } 50% { opacity:1; } }
        @keyframes shimmer  { 0% { background-position:200% center; } 100% { background-position:-200% center; } }
        .hero-btn:hover     { transform:translateY(-2px) !important; box-shadow:0 16px 40px rgba(108,99,255,0.5) !important; }
        .feature-card:hover { border-color:rgba(108,99,255,0.4) !important; transform:translateY(-4px) !important; }
        .loan-card:hover    { border-color:rgba(72,202,228,0.4) !important; transform:translateY(-3px) !important; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={styles.nav}>
        <div style={styles.navBrand}>
          <span style={styles.navIcon}>🏦</span>
          <div>
            <span style={styles.navName}>Poonawalla Fincorp</span>
            <span style={styles.navTag}>Video KYC Portal</span>
          </div>
        </div>
        <div style={styles.navLinks}>
          <a href="https://poonawallafincorp.com" target="_blank" rel="noreferrer"
             style={styles.navLink}>About Us</a>
          <a href="tel:18001033" style={styles.navLink}>📞 1800 103 3</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ ...styles.hero, opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}>

        {/* Decorative blobs */}
        <div style={styles.blob1} />
        <div style={styles.blob2} />

        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>
            <span style={styles.heroBadgeDot} />
            RBI Regulated · Secure · Instant
          </div>

          <h1 style={styles.heroTitle}>
            Get a Loan.<br />
            <span style={styles.heroAccent}>From Anywhere.</span>
          </h1>

          <p style={styles.heroSubtitle}>
            Complete your entire loan application — document upload, income verification,
            and KYC — through a secure 5-minute video call. No paperwork. No branch visits.
          </p>

          <div style={styles.heroStats}>
            <Stat value="₹50L+"    label="Max Loan Amount"   />
            <div style={styles.statDivider} />
            <Stat value="5 mins"   label="Avg. Process Time" />
            <div style={styles.statDivider} />
            <Stat value="9.99%"    label="Starting Interest"  />
          </div>

          <button
            className="hero-btn"
            style={styles.heroBtn}
            onClick={onGetStarted}
          >
            Apply Now — It's Free →
          </button>

          <p style={styles.heroNote}>
            No credit score impact · Instant eligibility check
          </p>
        </div>

        {/* Hero mockup card */}
        <div style={styles.heroCard}>
          <div style={styles.heroCardHeader}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(108,99,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                🎥
              </div>
              <div>
                <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Video KYC Session</p>
                <p style={{ margin:0, fontSize:11, color:"#48cae4" }}>● Live · Encrypted</p>
              </div>
            </div>
            <div style={{ background:"rgba(72,202,228,0.15)", border:"1px solid rgba(72,202,228,0.3)", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#48cae4" }}>
              REC ●
            </div>
          </div>

          <div style={styles.heroCardSteps}>
            {["Upload bank statement", "AI income verification", "Video call with agent", "Get your offer"].map((s, i) => (
              <div key={i} style={styles.heroCardStep}>
                <div style={{
                  ...styles.heroCardDot,
                  background: i < 2 ? "linear-gradient(90deg,#6c63ff,#48cae4)" : "rgba(255,255,255,0.1)",
                  border:     i < 2 ? "none" : "1px solid rgba(255,255,255,0.15)",
                }}>
                  {i < 2 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize:13, color: i < 2 ? "#fff" : "#666" }}>{s}</span>
              </div>
            ))}
          </div>

          <div style={styles.heroCardOffer}>
            <p style={{ margin:0, fontSize:11, color:"#aaa" }}>Estimated Offer</p>
            <p style={{ margin:"4px 0 0", fontSize:22, fontWeight:700, background:"linear-gradient(90deg,#6c63ff,#48cae4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              ₹15,00,000
            </p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:"#666" }}>@ 10.5% p.a. · 36 months</p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Why Poonawalla Fincorp?</h2>
        <p style={styles.sectionSub}>India's fastest growing fintech NBFC, trusted by 5M+ customers.</p>
        <div style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feature-card"
              style={{
                ...styles.featureCard,
                animation: visible ? `fadeUp 0.5s ease ${0.1 + i * 0.1}s both` : "none",
              }}
            >
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LOAN TYPES ── */}
      <section style={{ ...styles.section, paddingTop: 0 }}>
        <h2 style={styles.sectionTitle}>Loan Products</h2>
        <p style={styles.sectionSub}>Tailored financing for every need.</p>
        <div style={styles.loansGrid}>
          {LOAN_TYPES.map((l, i) => (
            <div key={i} className="loan-card" style={styles.loanCard}>
              <span style={{ fontSize: 28 }}>{l.icon}</span>
              <p style={styles.loanName}>{l.name}</p>
              <p style={styles.loanRate}>{l.rate}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ ...styles.section, paddingTop: 0 }}>
        <h2 style={styles.sectionTitle}>How It Works</h2>
        <div style={styles.stepsRow}>
          {[
            { n:"01", t:"Fill the Form",      d:"Enter your basic details and upload your bank statement." },
            { n:"02", t:"AI Verification",    d:"Our agents verify your income and check for authenticity." },
            { n:"03", t:"Video Call",         d:"Have a 5-minute video call for V-CIP compliance." },
            { n:"04", t:"Get Your Offer",     d:"Receive a personalised loan offer instantly." },
          ].map((s, i) => (
            <div key={i} style={styles.stepCard}>
              <span style={styles.stepN}>{s.n}</span>
              <h3 style={styles.stepT}>{s.t}</h3>
              <p style={styles.stepD}>{s.d}</p>
              {i < 3 && <div style={styles.stepArrow}>→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={styles.ctaSection}>
        <h2 style={{ fontSize:28, fontWeight:700, margin:"0 0 12px", color:"#fff" }}>
          Ready to get started?
        </h2>
        <p style={{ color:"#aaa", margin:"0 0 28px", fontSize:15 }}>
          Your entire loan application — in under 10 minutes.
        </p>
        <button
          className="hero-btn"
          style={{ ...styles.heroBtn, maxWidth: 320, margin:"0 auto", display:"block" }}
          onClick={onGetStarted}
        >
          Start My Application →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <p style={{ margin:0, color:"#444", fontSize:12 }}>
          © 2024 Poonawalla Fincorp Limited. All rights reserved. · NBFC regulated by RBI.
        </p>
        <p style={{ margin:"4px 0 0", color:"#333", fontSize:11 }}>
          Loans subject to credit assessment. Terms & conditions apply.
        </p>
      </footer>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign:"center" }}>
      <p style={{ margin:0, fontSize:22, fontWeight:700, color:"#fff" }}>{value}</p>
      <p style={{ margin:"2px 0 0", fontSize:11, color:"#888" }}>{label}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight:  "100vh",
    background: "linear-gradient(180deg, #0a0818 0%, #0f0c29 40%, #1a1040 100%)",
    color:      "#fff",
    fontFamily: "'Segoe UI', sans-serif",
    overflowX:  "hidden",
  },

  // Nav
  nav: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "18px 40px",
    borderBottom:   "1px solid rgba(255,255,255,0.06)",
    position:       "sticky",
    top:            0,
    background:     "rgba(10,8,24,0.85)",
    backdropFilter: "blur(12px)",
    zIndex:         50,
  },
  navBrand: { display:"flex", alignItems:"center", gap:10 },
  navIcon:  { fontSize:24 },
  navName:  { display:"block", fontWeight:700, fontSize:15, letterSpacing:"0.3px" },
  navTag:   { display:"block", fontSize:10, color:"#666", letterSpacing:"0.5px" },
  navLinks: { display:"flex", alignItems:"center", gap:24 },
  navLink:  { color:"#888", fontSize:13, textDecoration:"none" },

  // Hero
  hero: {
    display:       "flex",
    gap:           40,
    alignItems:    "center",
    padding:       "80px 40px 60px",
    maxWidth:      1140,
    margin:        "0 auto",
    position:      "relative",
    flexWrap:      "wrap",
  },
  blob1: {
    position:     "absolute",
    top:          -80,
    left:         -100,
    width:        500,
    height:       500,
    borderRadius: "50%",
    background:   "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)",
    pointerEvents:"none",
  },
  blob2: {
    position:     "absolute",
    bottom:       -100,
    right:        -80,
    width:        400,
    height:       400,
    borderRadius: "50%",
    background:   "radial-gradient(circle, rgba(72,202,228,0.08) 0%, transparent 70%)",
    pointerEvents:"none",
  },
  heroInner: {
    flex:    "1 1 400px",
    zIndex:  1,
  },
  heroBadge: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    padding:      "6px 14px",
    borderRadius: 99,
    border:       "1px solid rgba(108,99,255,0.3)",
    background:   "rgba(108,99,255,0.08)",
    fontSize:     12,
    color:        "#aaa",
    marginBottom: 24,
    letterSpacing:"0.3px",
  },
  heroBadgeDot: {
    width:      6,
    height:     6,
    borderRadius:"50%",
    background: "#6c63ff",
    animation:  "pulse 2s ease infinite",
    display:    "inline-block",
  },
  heroTitle: {
    fontSize:   clamp(36, 56),
    fontWeight: 800,
    lineHeight: 1.15,
    margin:     "0 0 20px",
    letterSpacing:"-1px",
  },
  heroAccent: {
    background:           "linear-gradient(90deg, #6c63ff, #48cae4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor:  "transparent",
    backgroundClip:       "text",
  },
  heroSubtitle: {
    fontSize:   16,
    color:      "#aaa",
    lineHeight: 1.7,
    maxWidth:   500,
    margin:     "0 0 32px",
  },
  heroStats: {
    display:     "flex",
    gap:         28,
    marginBottom:32,
    flexWrap:    "wrap",
  },
  statDivider: {
    width:      1,
    background: "rgba(255,255,255,0.1)",
    alignSelf:  "stretch",
  },
  heroBtn: {
    padding:      "16px 36px",
    borderRadius: 12,
    border:       "none",
    background:   "linear-gradient(90deg, #6c63ff, #48cae4)",
    color:        "#fff",
    fontSize:     16,
    fontWeight:   700,
    cursor:       "pointer",
    transition:   "all 0.25s ease",
    letterSpacing:"0.3px",
  },
  heroNote: {
    color:    "#555",
    fontSize: 12,
    margin:   "12px 0 0",
  },

  // Hero card
  heroCard: {
    flex:           "0 0 320px",
    background:     "rgba(255,255,255,0.04)",
    border:         "1px solid rgba(255,255,255,0.1)",
    borderRadius:   20,
    padding:        24,
    backdropFilter: "blur(20px)",
    zIndex:         1,
  },
  heroCardHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   20,
    paddingBottom:  16,
    borderBottom:   "1px solid rgba(255,255,255,0.07)",
  },
  heroCardSteps: {
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    marginBottom:  20,
  },
  heroCardStep: {
    display:    "flex",
    alignItems: "center",
    gap:        12,
  },
  heroCardDot: {
    width:          24,
    height:         24,
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       11,
    fontWeight:     700,
    flexShrink:     0,
    color:          "#fff",
  },
  heroCardOffer: {
    background:   "rgba(108,99,255,0.08)",
    border:       "1px solid rgba(108,99,255,0.2)",
    borderRadius: 12,
    padding:      "14px 16px",
  },

  // Sections
  section: {
    padding:   "60px 40px",
    maxWidth:  1140,
    margin:    "0 auto",
  },
  sectionTitle: {
    fontSize:   28,
    fontWeight: 700,
    margin:     "0 0 8px",
    textAlign:  "center",
  },
  sectionSub: {
    color:        "#888",
    textAlign:    "center",
    fontSize:     14,
    margin:       "0 0 40px",
  },

  // Features
  featuresGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap:                 20,
  },
  featureCard: {
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding:      "24px 20px",
    transition:   "all 0.3s ease",
  },
  featureIcon:  { fontSize:28, marginBottom:12 },
  featureTitle: { fontWeight:600, fontSize:15, margin:"0 0 8px" },
  featureDesc:  { color:"#888", fontSize:13, lineHeight:1.6, margin:0 },

  // Loans
  loansGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap:                 16,
  },
  loanCard: {
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(72,202,228,0.15)",
    borderRadius: 16,
    padding:      "24px 20px",
    textAlign:    "center",
    transition:   "all 0.3s ease",
  },
  loanName: { fontWeight:600, fontSize:14, margin:"10px 0 4px" },
  loanRate: { color:"#48cae4", fontSize:13, margin:0 },

  // Steps
  stepsRow: {
    display:  "flex",
    gap:      0,
    flexWrap: "wrap",
  },
  stepCard: {
    flex:       "1 1 200px",
    padding:    "20px 24px",
    position:   "relative",
  },
  stepN: {
    display:    "block",
    fontSize:   32,
    fontWeight: 800,
    color:      "rgba(108,99,255,0.4)",
    marginBottom:8,
  },
  stepT: { fontWeight:600, fontSize:15, margin:"0 0 6px" },
  stepD: { color:"#888", fontSize:13, lineHeight:1.6, margin:0 },
  stepArrow: {
    position:  "absolute",
    right:     -12,
    top:       "50%",
    transform: "translateY(-50%)",
    fontSize:  20,
    color:     "#333",
  },

  // CTA
  ctaSection: {
    textAlign:  "center",
    padding:    "60px 40px",
    background: "rgba(108,99,255,0.05)",
    borderTop:  "1px solid rgba(108,99,255,0.1)",
    borderBottom:"1px solid rgba(108,99,255,0.1)",
  },

  // Footer
  footer: {
    textAlign: "center",
    padding:   "32px 40px",
  },
};

function clamp(min, max) {
  return `clamp(${min}px, 5vw, ${max}px)`;
}
