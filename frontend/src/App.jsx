// src/App.jsx
// Proper URL routing using React Router:
//   /           → AuthPage
//   /home       → LandingPage
//   /apply      → PreCallForm
//   /processing → ProcessingScreen
//   /rejected   → FraudRejected
//   /call       → VideoCallPage
//   /review     → ExtractorReview
//   /offer      → LoanOffer
//   /error      → ErrorScreen
import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import AuthPage         from "./components/AuthPage";
import LandingPage      from "./components/LandingPage";
import PreCallForm      from "./components/PreCallForm";
import ProcessingScreen from "./components/ProcessingScreen";
import FraudRejected    from "./components/FraudRejected";
import VideoCallPage    from "./components/VideoCallPage";
import ExtractorReview  from "./components/ExtractorReview";
import LoanOffer        from "./components/LoanOffer";
import ErrorScreen      from "./components/ErrorScreen";

export default function App() {
  const navigate = useNavigate();

  const [user,       setUser]       = useState(null);
  const [callParams, setCallParams] = useState(null);
  const [loanResult, setLoanResult] = useState(null);
  const [fraudInfo,  setFraudInfo]  = useState(null);
  const [errorMsg,   setErrorMsg]   = useState(null);

  const goError = (msg) => { setErrorMsg(msg); navigate("/error"); };

  return (
    <Routes>

      <Route path="/" element={
        <AuthPage onAuth={(u) => { setUser(u); navigate("/home"); }} />
      } />

      <Route path="/home" element={
        <LandingPage
          user={user}
          onGetStarted={() => navigate("/apply")}
          onLogout={() => { setUser(null); navigate("/"); }}
        />
      } />

      <Route path="/apply" element={
        <PreCallForm
          user={user}
          onStartCall={(p) => { setCallParams(p); navigate("/processing"); }}
          onBack={() => navigate("/home")}
        />
      } />

      <Route path="/processing" element={
        <ProcessingScreen
          sessionId={callParams?.sessionId}
          onPassed={() => navigate("/call")}
          onFraudRejected={(info) => { setFraudInfo(info); navigate("/rejected"); }}
        />
      } />

      <Route path="/rejected" element={
        <FraudRejected
          signals={fraudInfo?.signals}
          weight={fraudInfo?.weight}
          onTryAgain={() => { setCallParams(null); setFraudInfo(null); navigate("/apply"); }}
        />
      } />

      <Route path="/call" element={
        <VideoCallPage
          sessionId    = {callParams?.sessionId}
          kycAddress   = {callParams?.kycAddress}
          statedIncome = {callParams?.statedIncome}
          onCallEnd    = {(result) => {
            if (result?.error) { goError(result.error); return; }
            setLoanResult(result);
            navigate("/review");
          }}
        />
      } />

      <Route path="/review" element={
        <ExtractorReview
          sessionId={callParams?.sessionId}
          onConfirmed={(offerData) => { setLoanResult(offerData); navigate("/offer"); }}
          onBack={() => navigate("/call")}
        />
      } />

      <Route path="/offer" element={
        <LoanOffer
          result={loanResult}
          onStartNew={() => { setLoanResult(null); setCallParams(null); navigate("/home"); }}
        />
      } />

      <Route path="/error" element={
        <ErrorScreen
          message={errorMsg}
          onRetry={() => { setErrorMsg(null); navigate("/apply"); }}
          onHome={() => { setErrorMsg(null); setCallParams(null); navigate("/home"); }}
        />
      } />

      {/* Catch-all — redirect unknown URLs to home */}
      <Route path="*" element={
        <AuthPage onAuth={(u) => { setUser(u); navigate("/home"); }} />
      } />

    </Routes>
  );
}

