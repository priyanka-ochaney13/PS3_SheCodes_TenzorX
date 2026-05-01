// src/App.jsx
import { useState } from "react";
import PreCallForm   from "./components/PreCallForm";
import VideoCallPage from "./components/VideoCallPage";
import LoanOffer     from "./components/LoanOffer";

export default function App() {
  const [stage, setStage]         = useState("precall"); // precall | call | offer
  const [callParams, setCallParams] = useState(null);
  const [loanResult, setLoanResult] = useState(null);

  if (stage === "precall") {
    return (
      <PreCallForm
        onStartCall={(params) => {
          setCallParams(params);
          setStage("call");
        }}
      />
    );
  }

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

  if (stage === "offer") {
    return <LoanOffer result={loanResult} />;
  }
}
