// src/App.jsx
// Full flow:
//   landing → precall → processing → (fraud_rejected | call) → offer
import { useState } from "react";
import LandingPage      from "./components/LandingPage";
import PreCallForm      from "./components/PreCallForm";
import ProcessingScreen from "./components/ProcessingScreen";
import FraudRejected    from "./components/FraudRejected";
import VideoCallPage    from "./components/VideoCallPage";
import LoanOffer        from "./components/LoanOffer";

export default function App() {
  const [stage,      setStage]      = useState("landing");
  const [callParams, setCallParams] = useState(null);
  const [loanResult, setLoanResult] = useState(null);
  const [fraudInfo,  setFraudInfo]  = useState(null);

  // Landing page
  if (stage === "landing") {
    return <LandingPage onGetStarted={() => setStage("precall")} />;
  }

  // Pre-call form
  if (stage === "precall") {
    return (
      <PreCallForm
        onStartCall={(params) => {
          setCallParams(params);
          setStage("processing");
        }}
      />
    );
  }

  // Processing / fraud pre-screen
  if (stage === "processing") {
    return (
      <ProcessingScreen
        sessionId={callParams.sessionId}
        onPassed={() => setStage("call")}
        onFraudRejected={(info) => {
          setFraudInfo(info);
          setStage("fraud_rejected");
        }}
      />
    );
  }

  // Fraud rejection
  if (stage === "fraud_rejected") {
    return (
      <FraudRejected
        signals={fraudInfo?.signals}
        weight={fraudInfo?.weight}
        onTryAgain={() => {
          setCallParams(null);
          setFraudInfo(null);
          setStage("precall");
        }}
      />
    );
  }

  // Video call
  if (stage === "call") {
    return (
      <VideoCallPage
        sessionId    = {callParams.sessionId}
        kycAddress   = {callParams.kycAddress}
        statedIncome = {callParams.statedIncome}
        onCallEnd    = {(result) => {
          setLoanResult(result);
          setStage("offer");
        }}
      />
    );
  }

  // Loan offer
  if (stage === "offer") {
    return (
      <LoanOffer
        result={loanResult}
        onStartNew={() => {
          setLoanResult(null);
          setCallParams(null);
          setStage("landing");
        }}
      />
    );
  }

  return null;
}
