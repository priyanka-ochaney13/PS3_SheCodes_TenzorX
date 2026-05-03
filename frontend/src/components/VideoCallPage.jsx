// Spec + LLM-driven video call flow:
//
// ON MOUNT:
//   - POST /session/{id}/activate
//   - Request camera + mic (getUserMedia)
//
// SHOW CONSENT MODAL:
//   - When "I Agree": POST /session/{id}/consent
//   - Request GPS (navigator.geolocation.getCurrentPosition, fire-and-forget)
//   - Schedule frame capture for 5 seconds
//
// WHEN GPS resolves (fire and forget, don't await):
//   - POST /agents/geo/{id} with { live_lat, live_lon, kyc_address }
//
// WHEN CAMERA STREAM READY:
//   - Show video element
//   - After 5 seconds: capture frame → POST /documents/upload/live-frame
//   - auto-triggers deepface in background
//
// START QUESTIONS (do not start until GPS has been requested):
//   For each question from LLM (via next_action endpoint):
//     1. POST /agents/speech/{id}/next_action { turns }
//        → LLM returns next_question or COMPLETE_CONVERSATION
//     2. POST /agents/speech/{id}/speak { text: question }
//     3. Record mic until silence (1.5s) OR "Done" clicked
//     4. POST /agents/transcribe_chunk { audio, session_id, question }
//     5. Append to turns: { role: "agent", text } + { role: "customer", text }
//
// AFTER COMPLETE_CONVERSATION:
//   - Build full_transcript
//   - POST /agents/speech/{id}/save with turns + full_transcript
//   - Stop all media tracks
//   - Call onCallEnd({ sessionId })

import { useEffect, useRef, useState, useCallback } from "react";
import api from "../services/api";

export default function VideoCallPage({ sessionId, kycAddress, statedIncome, onCallEnd }) {
  const videoRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const chunksRef        = useRef([]);
  const turnsRef         = useRef([]);
  const silenceTimeoutRef = useRef(null);

  const [phase,         setPhase]         = useState("consent");   // consent | active | processing | done
  const [isRecording,   setIsRecording]   = useState(false);
  const [timeLeft,      setTimeLeft]      = useState(null);
  const [turns,         setTurns]         = useState([]);
  const [statusMsg,     setStatusMsg]     = useState("");
  const [error,         setError]         = useState(null);
  const [geoCoords,     setGeoCoords]     = useState(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [gpsRequested,  setGpsRequested]  = useState(false);

  // ── Activate session on mount ───────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await api.post(`/session/${sessionId}/activate`);
      } catch (_) {}
    })();
  }, [sessionId]);

  // ── GPS (collected on consent, fire-and-forget to backend) ─
  const requestGeolocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGeoCoords({ lat, lon });
        // Fire-and-forget: POST to geo agent
        sendGeoToBackend(lat, lon);
        setGpsRequested(true);
      },
      () => {
        console.warn("Geolocation denied — geo agent will skip");
        setGpsRequested(true);
      }
    );
  };

  // ── Fire-and-forget geo POST ─────────────────────────────
  const sendGeoToBackend = (lat, lon) => {
    const fd = new FormData();
    fd.append("live_lat",    String(lat));
    fd.append("live_lon",    String(lon));
    fd.append("kyc_address", kycAddress);
    api.post(`/agents/geo/${sessionId}`, fd).catch(() => {});
  };

  // ── Camera + mic ──────────────────────────────────────
  useEffect(() => {
    const requestMedia = async () => {
      try {
        setStatusMsg("Requesting camera and microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            console.warn("Video autoplay failed, but stream is active");
          });
        }
        setStatusMsg("");
      } catch (err) {
        console.error("getUserMedia error:", err);
        if (err.name === "NotAllowedError") {
          setError("❌ Microphone/camera permission denied. Please:\n1. Click the camera icon in the address bar\n2. Select 'Allow' for camera and microphone\n3. Refresh the page");
        } else if (err.name === "NotFoundError") {
          setError("❌ No camera or microphone found on this device.");
        } else if (err.name === "NotReadableError") {
          setError("❌ Camera/microphone is busy or already in use by another app.");
        } else {
          setError("❌ Cannot access media: " + err.message + "\nPlease check your browser permissions.");
        }
      }
    };

    requestMedia();

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Consent → request GPS and start frame capture ────────
  const handleConsent = async () => {
    try { await api.post(`/session/${sessionId}/consent`); } catch (_) {}
    requestGeolocation();
    scheduleFrameCapture();
    // Wait for GPS before showing active phase
    setPhase("active");
  };

  // ── Wait for GPS, then start questions ────────────────────
  useEffect(() => {
    if (phase === "active" && gpsRequested) {
      setStatusMsg("GPS confirmed, starting questions...");
      askNextQuestion([]);
    }
  }, [phase, gpsRequested]);

  // ── Ask next question (LLM-driven) ────────────────────────
  const askNextQuestion = useCallback(async (currentTurns) => {
    try {
      setAgentSpeaking(true);
      setStatusMsg("Agent thinking...");
      console.log("🤖 Fetching next AI action...");

      const res = await api.post(
        `/agents/speech/${sessionId}/next_action`,
        { turns: currentTurns }
      );
      const { next_action, next_question } = res.data;
      console.log("🤖 AI Response received:", next_question || next_action);

      // LLM says we're done — wrap up
      if (next_action === "COMPLETE_CONVERSATION" || !next_question) {
        setAgentSpeaking(false);
        await finishCall(currentTurns);
        return;
      }

      // Add agent turn to transcript
      const agentTurn    = { role: "agent", text: next_question };
      const updatedTurns = [...currentTurns, agentTurn];
      turnsRef.current   = updatedTurns;
      setTurns(updatedTurns);

      // Speak the question
      await speakText(next_question);
      setAgentSpeaking(false);

      // Record customer answer
      await recordAnswer(updatedTurns, next_question);

    } catch (err) {
      setAgentSpeaking(false);
      setError("Conversation error: " + (err.response?.data?.detail || err.message));
    }
  }, [sessionId]);

  // ── TTS: ElevenLabs → Audio Element, fallback browser TTS ─
  const speakText = (text) =>
    new Promise(async (resolve) => {
      try {
        const res = await api.post(`/agents/speech/${sessionId}/speak`, { text }, {
          responseType: 'blob'
        });
        const url = URL.createObjectURL(res.data);
        const audio = new Audio(url);
        
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        
        audio.onerror = (e) => {
          console.error("❌ Audio playback error:", e);
          URL.revokeObjectURL(url);
          fallbackTTS(text, resolve);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("⚠️ Autoplay blocked, using fallback TTS", err);
            fallbackTTS(text, resolve);
          });
        }
      } catch (err) {
        console.warn("⚠️ ElevenLabs request failed, using fallback TTS", err);
        fallbackTTS(text, resolve);
      }
    });

  const fallbackTTS = (text, resolve) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.lang = "en-IN";
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  };

  const audioCtxRef = useRef(null);

  // ── Record answer (with silence detection) ───────────────
  const recordAnswer = (currentTurns, question) =>
    new Promise(async (resolve) => {
      if (!streamRef.current) { resolve(currentTurns); return; }
      
      setIsRecording(true);
      setTimeLeft(20);
      chunksRef.current = [];

      let recorderInstance = null;
      try {
        // Ensure audio tracks are healthy
        const audioTracks = streamRef.current.getAudioTracks();
        if (audioTracks.length === 0) throw new Error("No audio tracks found.");
        
        audioTracks.forEach(t => {
          if (t.readyState === 'live' && !t.enabled) t.enabled = true;
        });

        // Clone the stream - often more stable than 'new MediaStream(tracks)'
        const audioStream = new MediaStream([audioTracks[0].clone()]);
        
        // Try creating recorder without options first (most compatible)
        try {
          recorderInstance = new MediaRecorder(audioStream);
          console.log("🎤 Created MediaRecorder with browser defaults");
        } catch (e1) {
          console.warn("⚠️ Default MediaRecorder failed, trying with WebM...", e1);
          recorderInstance = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        }
        
        if (recorderInstance.state !== "inactive") {
          throw new Error(`MediaRecorder state is ${recorderInstance.state}`);
        }
      } catch (e) {
        console.error("❌ MediaRecorder initialization error:", e);
        setError("Audio recording not supported: " + e.message);
        setIsRecording(false);
        resolve(currentTurns);
        return;
      }
      mediaRecorderRef.current = recorderInstance;

      // Setup silence detection using a singleton AudioContext
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      const analyser = audioCtx.createAnalyser();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const source = audioCtx.createMediaStreamSource(recorderInstance.stream);
      source.connect(analyser);

      let silenceDuration = 0;
      let recordingDuration = 0;
      const silenceThreshold = 15; // Slightly more sensitive
      const silenceCheckInterval = 100;
      const requiredSilenceDuration = 1800; 
      const minimumRecordingMs = 1500; 

      const checkSilence = setInterval(() => {
        if (!recorderInstance || recorderInstance.state !== "recording") return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        if (recordingDuration % 1000 === 0) {
          console.log(`🔊 Volume: ${average.toFixed(1)} | Data: ${chunksRef.current.length} chunks`);
        }

        recordingDuration += silenceCheckInterval;
        
        if (average < silenceThreshold) {
          silenceDuration += silenceCheckInterval;
          if (silenceDuration >= requiredSilenceDuration && 
              recordingDuration >= minimumRecordingMs &&
              chunksRef.current.length > 0) {
            console.log("🤫 Silence detected, stopping recorder");
            clearInterval(checkSilence);
            if (recorderInstance.state === "recording") recorderInstance.stop();
            return;
          }
        } else {
          silenceDuration = 0;
        }
      }, silenceCheckInterval);

      recorderInstance.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorderInstance.onstop = async () => {
        clearInterval(checkSilence);
        setIsRecording(false);
        setTimeLeft(null);
        setStatusMsg("Transcribing your answer...");
        
        // Cleanup tracks
        recorderInstance.stream.getTracks().forEach(t => t.stop());

        const recordedBlob = new Blob(chunksRef.current, { type: recorderInstance.mimeType });
        console.log(`✅ Recording finished. Total size: ${recordedBlob.size} bytes`);

        let text = "";
        if (recordedBlob.size < 2000) {
          console.warn("⚠️ Audio blob too small.");
          text = "(silence)";
        } else {
          text = await transcribeAudio(recordedBlob, question);
        }

        const customerTurn = { role: "customer", text: text || "(no response)" };
        const updated      = [...currentTurns, customerTurn];
        turnsRef.current   = updated;
        setTurns(updated);
        resolve(updated);
        await askNextQuestion(updated);
      };

      let remaining = 20;
      const timer = setInterval(() => {
        if (recorderInstance.state === "recording") {
          remaining -= 1;
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(timer);
            recorderInstance.stop();
          }
        }
      }, 1000);

      try {
        if (audioCtx.state === "suspended") await audioCtx.resume();
        recorderInstance.start(200); 
      } catch (err) {
        console.error("❌ Failed to start MediaRecorder:", err);
        setError("Microphone error: Could not start recording.");
        setIsRecording(false);
        clearInterval(checkSilence);
        clearInterval(timer);
        resolve(currentTurns);
      }
    });

  // Manual stop (customer clicks "Done Speaking")
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      clearInterval(mediaRecorderRef.current._autoTimer);
      mediaRecorderRef.current.stop();
    }
  };

  // ── Groq Whisper transcription ────────────────────────
  const transcribeAudio = async (blob, question) => {
    try {
      console.log("🛰️ Sending for transcription...", { size: blob.size, type: blob.type });
      const fd = new FormData();
      
      // Determine extension from mime type
      let ext = "webm";
      if (blob.type.includes("mp4")) ext = "mp4";
      else if (blob.type.includes("ogg")) ext = "ogg";
      else if (blob.type.includes("wav")) ext = "wav";

      fd.append("audio", blob, `recording.${ext}`);
      fd.append("session_id", sessionId);
      fd.append("question",   question);
      const res = await api.post("/agents/transcribe_chunk", fd);
      console.log("📝 Transcript received:", res.data.transcript);
      return res.data.transcript || "";
    } catch (err) {
      console.error("❌ Transcription error:", err);
      return "";
    }
  };

  // ── Schedule frame capture 5s after video stream is ready ─
  // Uploads to /documents/upload/live-frame
  // Backend auto-triggers /process_kyc_full (deepface microservice)
  // which uses kyc_photo + aadhaar_card + pan_card already uploaded in PreCallForm
  const scheduleFrameCapture = () => {
    // Try capturing every 3 seconds until successful or call ends
    const timer = setInterval(async () => {
      if (phase !== "active") {
        clearInterval(timer);
        return;
      }
      const success = await captureFrame();
      if (success) {
        console.log("📸 Live frame captured and uploaded successfully");
        clearInterval(timer);
      }
    }, 3000);
  };

  const captureFrame = async () => {
    if (!videoRef.current || !streamRef.current) return false;
    const video = videoRef.current;
    
    // Ensure video is actually playing and has dimensions
    if (!video.readyState || video.readyState < 2 || video.videoWidth === 0) {
      console.warn("📸 Video not ready for capture yet...");
      return false;
    }

    try {
      const canvas  = document.createElement("canvas");
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      return await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          try {
            const fd = new FormData();
            fd.append("session_id", sessionId);
            fd.append("file", blob, "live_frame.jpg");
            await api.post("/documents/upload/live-frame", fd);
            resolve(true);
          } catch (err) {
            console.error("📸 Frame upload failed:", err);
            resolve(false);
          }
        }, "image/jpeg", 0.90);
      });
    } catch (err) {
      console.error("📸 Canvas capture error:", err);
      return false;
    }
  };

  // ── Send GPS to geo agent (fire-and-forget) ──────────────
  const sendGeo = () => {
    if (!geoCoords || !kycAddress) return;
    const fd = new FormData();
    fd.append("live_lat",    String(geoCoords.lat));
    fd.append("live_lon",    String(geoCoords.lon));
    fd.append("kyc_address", kycAddress);
    api.post(`/agents/geo/${sessionId}`, fd).catch(() => {});
  };

  // ── Finish call ───────────────────────────────────────────
  const finishCall = async (finalTurns) => {
    setPhase("processing");
    window.speechSynthesis.cancel();

    try {
      // Step 1 — stop camera
      streamRef.current?.getTracks().forEach((t) => t.stop());

      // Step 2 — build full transcript
      setStatusMsg("Saving transcript...");
      const fullTranscript = finalTurns
        .map((t) => `${t.role === "agent" ? "Agent" : "Customer"}: ${t.text}`)
        .join("\n");

      // Step 3 — save full speech output to DB
      await api.post(`/agents/speech/${sessionId}/save`, {
        agent:             "speech",
        status:            "completed",
        language:          "en",
        turns:             finalTurns,
        full_transcript:   fullTranscript,
        fraud_signals:     [],
        conversation_risk: "low",
      });

      // Step 4 — done, hand off to App.jsx
      setPhase("done");
      onCallEnd({ sessionId });

    } catch (err) {
      setError("Processing error: " + (err.response?.data?.detail || err.message));
      setPhase("active");
    }
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div style={st.page}>

      {/* ── Consent modal ── */}
      {phase === "consent" && (
        <div style={st.overlay}>
          <div style={st.modal}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>📋</div>
            <h2 style={{ margin: "0 0 16px", color: "#111", textAlign: "center", fontSize: 20 }}>
              RBI V-CIP Consent
            </h2>
            <p style={st.consentText}>
              This video call is being recorded for regulatory compliance as per RBI
              Video-based Customer Identification Process (V-CIP) guidelines.
            </p>
            <p style={st.consentText}>
              Your face will be verified against your KYC records. Your location
              will be checked against your registered address.
            </p>
            <p style={st.consentText}>
              By clicking <strong>I Agree</strong>, you consent to this recording and verification.
            </p>
            <button style={st.consentBtn} onClick={handleConsent}>
              ✅ I Agree — Start Call
            </button>
          </div>
        </div>
      )}

      {/* ── Main call layout ── */}
      <div style={st.layout}>

        {/* Left — video feed */}
        <div style={st.videoPanel}>
          <div style={st.videoWrap}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={st.video}
            />

            {/* Status badges overlaid on video */}
            {isRecording && (
              <div style={st.badge}>
                🔴 Recording — {timeLeft}s — speak now
              </div>
            )}
            {agentSpeaking && !isRecording && phase === "active" && (
              <div style={{ ...st.badge, background: "rgba(0,0,0,0.65)" }}>
                🤖 Agent speaking...
              </div>
            )}
            {phase === "processing" && (
              <div style={{ ...st.badge, background: "rgba(26,86,219,0.9)" }}>
                ⚙️ {statusMsg}
              </div>
            )}
          </div>

          {/* Manual stop button */}
          {isRecording && (
            <button style={st.stopBtn} onClick={stopRecording}>
              ⏹ Done Speaking
            </button>
          )}

          {/* Progress dots — one per completed agent turn */}
          {phase === "active" && turns.length > 0 && (
            <div style={st.dotsRow}>
              {turns
                .filter((t) => t.role === "agent")
                .map((_, i) => (
                  <div key={i} style={st.dot} />
                ))}
            </div>
          )}
        </div>

        {/* Right — live transcript */}
        <div style={st.transcriptPanel}>
          <h3 style={st.transcriptTitle}>
            {phase === "processing" ? "⚙️ Processing..." : "Live Transcript"}
          </h3>

          <div style={st.transcriptBody}>
            {turns.length === 0 && phase === "active" && (
              <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
                Conversation will appear here...
              </p>
            )}
            {turns.length === 0 && phase === "consent" && (
              <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
                Accept consent to begin the call.
              </p>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                style={{
                  ...st.bubble,
                  background:   t.role === "agent"
                    ? "rgba(108,99,255,0.18)"
                    : "rgba(72,202,228,0.15)",
                  alignSelf:    t.role === "agent" ? "flex-start" : "flex-end",
                  borderRadius: t.role === "agent"
                    ? "4px 16px 16px 16px"
                    : "16px 4px 16px 16px",
                }}
              >
                <span style={st.bubbleRole}>
                  {t.role === "agent" ? "🤖 Agent" : "👤 You"}
                </span>
                <p style={st.bubbleText}>{t.text}</p>
              </div>
            ))}
          </div>

          {/* Processing status list */}
          {phase === "processing" && (
            <div style={st.statusBox}>
              <p style={{ color: "#48cae4", fontWeight: 600, margin: "0 0 8px", fontSize: 13 }}>
                Running verification agents...
              </p>
              {[
                { key: "face",        label: "Face verification (DeepFace)" },
                { key: "geo",         label: "Location check" },
                { key: "speech",      label: "Conversation analysis" },
                { key: "transaction", label: "Bank statement analysis" },
                { key: "pipeline",    label: "AI decision pipeline" },
              ].map(({ key, label }) => (
                <div key={key} style={st.statusRow}>
                  <span style={{ color: "#aaa", fontSize: 12 }}>{label}</span>
                  <span style={{ fontSize: 12 }}>⏳</span>
                </div>
              ))}
            </div>
          )}

          {error && <p style={st.error}>⚠️ {error}</p>}
        </div>
      </div>
    </div>
  );
}

const st = {
  page: {
    minHeight:      "100vh",
    background:     "#0d0d0d",
    color:          "#fff",
    fontFamily:     "'Segoe UI', sans-serif",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    padding:        16,
  },
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.88)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         100,
    padding:        32,
  },
  modal: {
    background:   "#fff",
    borderRadius: 16,
    padding:      "36px 32px",
    maxWidth:     480,
    width:        "100%",
  },
  consentText: {
    color:        "#555",
    lineHeight:   1.7,
    marginBottom: 10,
    fontSize:     14,
  },
  consentBtn: {
    width:        "100%",
    padding:      14,
    borderRadius: 10,
    border:       "none",
    background:   "#1a56db",
    color:        "#fff",
    fontSize:     15,
    fontWeight:   700,
    cursor:       "pointer",
    marginTop:    12,
    fontFamily:   "'Segoe UI', sans-serif",
  },
  layout: {
    display:  "flex",
    gap:      24,
    width:    "100%",
    maxWidth: 1100,
    flexWrap: "wrap",
  },
  videoPanel: {
    flex:          "1 1 420px",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
  },
  videoWrap: {
    position:     "relative",
    borderRadius: 16,
    overflow:     "hidden",
    background:   "#111",
    aspectRatio:  "4/3",
  },
  video: {
    width:       "100%",
    height:      "100%",
    objectFit:   "cover",
    transform:   "scaleX(-1)",   // mirror effect
  },
  badge: {
    position:     "absolute",
    bottom:       12,
    left:         12,
    background:   "rgba(220,50,50,0.85)",
    borderRadius: 8,
    padding:      "6px 14px",
    fontSize:     13,
    fontWeight:   600,
  },
  stopBtn: {
    padding:      "12px 0",
    borderRadius: 10,
    border:       "none",
    background:   "#ff4757",
    color:        "#fff",
    fontSize:     14,
    fontWeight:   700,
    cursor:       "pointer",
    fontFamily:   "'Segoe UI', sans-serif",
  },
  dotsRow: {
    display:        "flex",
    gap:            8,
    justifyContent: "center",
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: "50%",
    background:   "#6c63ff",
  },
  transcriptPanel: {
    flex:          "1 1 320px",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    maxHeight:     580,
  },
  transcriptTitle: {
    margin:     0,
    fontSize:   15,
    color:      "#aaa",
    fontWeight: 600,
  },
  transcriptBody: {
    flex:          1,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    padding:       4,
  },
  bubble: {
    padding:  "10px 14px",
    maxWidth: "85%",
  },
  bubbleRole: {
    fontSize:     11,
    color:        "#888",
    display:      "block",
    marginBottom: 4,
  },
  bubbleText: {
    margin:     0,
    fontSize:   14,
    lineHeight: 1.5,
  },
  statusBox: {
    background:   "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding:      16,
  },
  statusRow: {
    display:        "flex",
    justifyContent: "space-between",
    marginBottom:   6,
  },
  error: {
    color:    "#ff6b6b",
    fontSize: 13,
    margin:   0,
  },
};
