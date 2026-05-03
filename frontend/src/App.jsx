// src/App.jsx
// Full flow: auth → landing → precall → processing → (fraud_rejected | call) → extractor_review → offer
//            → error (fallback)
import { useState } from "react";
import AuthPage        from "./components/AuthPage";
import LandingPage     from "./components/LandingPage";
import PreCallForm     from "./components/PreCallForm";
import ProcessingScreen from "./components/ProcessingScreen";
import FraudRejected   from "./components/FraudRejected";
import VideoCallPage   from "./components/VideoCallPage";
import ExtractorReview from "./components/ExtractorReview";
import LoanOffer       from "./components/LoanOffer";
import ErrorScreen     from "./components/ErrorScreen";

export default function App() {
  const [stage,      setStage]      = useState("auth");
  const [user,       setUser]       = useState(null);
  const [callParams, setCallParams] = useState(null);
  const [loanResult, setLoanResult] = useState(null);
  const [fraudInfo,  setFraudInfo]  = useState(null);
  const [errorMsg,   setErrorMsg]   = useState(null);

  const goError = (msg) => { setErrorMsg(msg); setStage("error"); };

  if (stage === "auth")
    return <AuthPage onAuth={(u) => { setUser(u); setStage("landing"); }} />;

  if (stage === "landing")
    return <LandingPage user={user} onGetStarted={() => setStage("precall")}
             onLogout={() => { setUser(null); setStage("auth"); }} />;

  if (stage === "precall")
    return <PreCallForm user={user}
             onStartCall={(p) => { setCallParams(p); setStage("processing"); }}
             onBack={() => setStage("landing")} />;

  if (stage === "processing")
    return <ProcessingScreen sessionId={callParams.sessionId}
             onPassed={() => setStage("call")}
             onFraudRejected={(info) => { setFraudInfo(info); setStage("fraud_rejected"); }} />;

  if (stage === "fraud_rejected")
    return <FraudRejected signals={fraudInfo?.signals} weight={fraudInfo?.weight}
             onTryAgain={() => { setCallParams(null); setFraudInfo(null); setStage("precall"); }} />;

  if (stage === "call")
    return <VideoCallPage
             sessionId    = {callParams.sessionId}
             kycAddress   = {callParams.kycAddress}
             statedIncome = {callParams.statedIncome}
             onCallEnd    = {(result) => {
               if (result?.error) { goError(result.error); return; }
               setLoanResult(result);
               setStage("extractor_review");
             }} />;

  if (stage === "extractor_review")
    return <ExtractorReview sessionId={callParams.sessionId}
             onConfirmed={(offerData) => { setLoanResult(offerData); setStage("offer"); }}
             onBack={() => setStage("call")} />;

  if (stage === "offer")
    return <LoanOffer result={loanResult}
             onStartNew={() => { setLoanResult(null); setCallParams(null); setStage("landing"); }} />;

  if (stage === "error")
    return <ErrorScreen message={errorMsg}
             onRetry={() => { setErrorMsg(null); setStage("precall"); }}
             onHome={() => { setErrorMsg(null); setCallParams(null); setStage("landing"); }} />;

  return null;
}
