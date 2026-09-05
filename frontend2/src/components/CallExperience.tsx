"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff, Volume2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type CallState = "connecting" | "connected" | "ended";

type Message = {
  id: string;
  speaker: "RAAHI" | "USER";
  text: string;
};

type ExtractedData = {
  DISTRICT?: string;
  AGE?: string;
  PREFERENCE?: string;
  "SKILL INTENT"?: string;
};

interface CallExperienceProps {
  isActive: boolean;
  onClose: () => void;
}

export default function CallExperience({ isActive, onClose }: CallExperienceProps) {
  const [callState, setCallState] = useState<CallState>("connecting");
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [extracted, setExtracted] = useState<ExtractedData>({});
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { t, language } = useLanguage();
  
  // Ref for auto-scrolling transcript
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Formatting time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Main  // Start Call Sequence
  useEffect(() => {
    if (typeof window !== "undefined") {
      setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    
    if (!isActive) {
      // Reset state when closed
      setCallState("connecting");
      setTimer(0);
      setMessages([]);
      setExtracted({});
      setShowRecommendation(false);
      return;
    }

    let t_seconds = 0;
    let timerInterval: NodeJS.Timeout;
    let sequenceInterval: NodeJS.Timeout;

    // Start connecting phase
    sequenceInterval = setInterval(() => {
      t_seconds++;
      
      // 2s: Connected
      if (t_seconds === 2 && callState !== "ended") {
        setCallState("connected");
        timerInterval = setInterval(() => {
          setTimer((prev) => prev + 1);
        }, 1000);
      }
      
      if (callState === "ended") return;

      // 4s: RAAHI asks district
      if (t_seconds === 4) {
        setMessages(prev => [...prev, { id: "1", speaker: "RAAHI", text: t.call.qDistrict }]);
      }
      // 7s: User answers
      if (t_seconds === 7) {
        setMessages(prev => [...prev, { id: "2", speaker: "USER", text: t.call.aDistrict }]);
      }
      // 10s: Extract District
      if (t_seconds === 10) {
        setExtracted(prev => ({ ...prev, DISTRICT: "Nalanda" }));
      }
      // 13s: RAAHI asks preference
      if (t_seconds === 13) {
        setMessages(prev => [...prev, { id: "3", speaker: "RAAHI", text: t.call.qPreference }]);
      }
      // 16s: User answers
      if (t_seconds === 16) {
        setMessages(prev => [...prev, { id: "4", speaker: "USER", text: t.call.aPreference }]);
      }
      // 19s: Extract Preference
      if (t_seconds === 19) {
        setExtracted(prev => ({ ...prev, PREFERENCE: "Salaried" }));
      }
      // 21s: Extract Skill Intent
      if (t_seconds === 21) {
        setExtracted(prev => ({ ...prev, "SKILL INTENT": "Mobile Repair" }));
      }
      // 23s: Extract Age (implied or from earlier profile)
      if (t_seconds === 23) {
        setExtracted(prev => ({ ...prev, AGE: "24" }));
      }
      // 27s: Recommendation
      if (t_seconds === 27) {
        setShowRecommendation(true);
      }

    }, 1000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(sequenceInterval);
    };
  }, [isActive, callState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEndCall = () => {
    setCallState("ended");
  };

  if (!isActive) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0f18", // Dark navy/black
        zIndex: 9999,
        display: "block",
        color: "white",
        fontFamily: "var(--font-hind), sans-serif",
        overflow: "hidden"
      }}
    >
      {!reduceMotion && (
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: 0,
            pointerEvents: "none"
          }}
        >
          <source src="/videos/Animate_autumn_village_scene_breeze_202609031852_gwr_video_mvp.mp4" type="video/mp4" />
        </video>
      )}
      
      {/* Background Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle, rgba(10,15,24,0.4) 0%, rgba(10,15,24,0.85) 100%)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />
      
      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="call-exp-container" style={{ position: "relative", width: "100%" }}>
          
          {/* LEFT SIDE - TRANSCRIPT */}
          <div className="call-panel-left">
            <motion.div
            initial={{ opacity: 0, x: language === 'ur' || language === 'ks' || language === 'sd' ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            style={{ height: "60%", display: "flex", flexDirection: "column" }}
          >
            <h3 style={{ fontSize: "0.8rem", letterSpacing: "2px", color: "var(--color-sun)", textTransform: "uppercase", marginBottom: "2rem" }}>LIVE TRANSCRIPT</h3>
            <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingRight: "1rem" }}>
              <AnimatePresence>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.speaker === "RAAHI" ? "flex-start" : "flex-end"
                    }}
                  >
                    <span style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: "0.25rem", letterSpacing: "1px" }}>{msg.speaker}</span>
                    <div style={{
                      backgroundColor: msg.speaker === "RAAHI" ? "#16283a" : "#2a1e12",
                      padding: "1rem 1.25rem",
                      borderRadius: msg.speaker === "RAAHI" ? "0 16px 16px 16px" : "16px 0 16px 16px",
                      border: `1px solid ${msg.speaker === "RAAHI" ? "#1e3a5f" : "#4a3520"}`,
                      maxWidth: "90%",
                      fontSize: "1.1rem"
                    }}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* CENTER - PHONE */}
        <div className="call-panel-center">
          <motion.div
            initial={{ rotateX: 45, y: 150, scale: 0.8, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} // Cinematic physical ease
            style={{
              width: "320px",
              height: "660px",
              backgroundColor: "#0d1117",
              borderRadius: "45px",
              border: "12px solid #000",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.5)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Phone Screen Glow */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(26,50,69,0.5) 0%, transparent 70%)", pointerEvents: "none" }} />
            
            {/* Phone Top / Notch */}
            <div style={{ width: "100%", height: "40px", display: "flex", justifyContent: "center", alignItems: "flex-end", zIndex: 10 }}>
              <div style={{ width: "80px", height: "20px", backgroundColor: "#000", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }} />
            </div>

            {/* Phone Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1.5rem", zIndex: 10 }}>
              
              {/* Call Status Top */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: callState === "connected" ? "#10b981" : (callState === "ended" ? "#6b7280" : "#f59e0b") }} />
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af", letterSpacing: "1px", textTransform: "uppercase" }}>
                    {callState === "connecting" ? t.call.connecting : (callState === "ended" ? t.call.callEnded : "LIVE CALL")}
                  </span>
                </div>
                {callState === "connected" && (
                  <span style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "300", color: "#e5e7eb" }}>{formatTime(timer)}</span>
                )}
                {callState === "ended" && (
                  <span style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "300", color: "#e5e7eb" }}>{formatTime(timer)}</span>
                )}
              </div>

              {/* Center ID */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <motion.div 
                  animate={{ scale: callState === "connected" ? [1, 1.05, 1] : 1 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  style={{
                    width: "100px", height: "100px", borderRadius: "50%",
                    background: callState === "connected" ? "linear-gradient(135deg, #1e3a5f, #0f172a)" : "#1f2937",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    boxShadow: callState === "connected" ? "0 0 30px rgba(30,58,95,0.4)" : "none",
                    marginBottom: "1.5rem"
                  }}
                >
                  <h2 style={{ fontFamily: "var(--font-yatra-one)", fontSize: "2rem", color: "white", margin: 0 }}>R</h2>
                </motion.div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.25rem" }}>RAAHI</h3>
                <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>{t.call.livelihoodCounselor}</span>
              </div>

              {/* End Screen Content */}
              {callState === "ended" && (
                <div style={{ width: "100%", marginBottom: "2rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.9rem", color: "#10b981", marginBottom: "1rem" }}>{t.call.profilePrepared}</p>
                  <button 
                    onClick={onClose}
                    style={{
                      background: "transparent",
                      border: "1px solid #374151",
                      color: "white",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "100px",
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    {t.call.returnHome}
                  </button>
                </div>
              )}

              {/* Bottom Controls */}
              {callState !== "ended" && (
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1rem", marginBottom: "1rem" }}>
                  <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "#1f2937", display: "flex", justifyContent: "center", alignItems: "center", color: "#9ca3af" }}>
                    <MicOff size={20} />
                  </div>
                  <button 
                    onClick={handleEndCall}
                    style={{ 
                      width: "70px", height: "70px", borderRadius: "50%", 
                      backgroundColor: "#ef4444", 
                      display: "flex", justifyContent: "center", alignItems: "center",
                      color: "white",
                      border: "none", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)"
                    }}
                  >
                    <PhoneOff size={28} />
                  </button>
                  <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "#1f2937", display: "flex", justifyContent: "center", alignItems: "center", color: "#9ca3af" }}>
                    <Volume2 size={20} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE - EXTRACTION */}
        <div className="call-panel-right">
          <motion.div
            initial={{ opacity: 0, x: language === 'ur' || language === 'ks' || language === 'sd' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            style={{ height: "60%", display: "flex", flexDirection: "column" }}
          >
            <h3 style={{ fontSize: "0.8rem", letterSpacing: "2px", color: "var(--color-sun)", textTransform: "uppercase", marginBottom: "2rem" }}>LIVE EXTRACTION</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
              {["DISTRICT", "AGE", "PREFERENCE", "SKILL INTENT"].map((key) => (
                <div key={key} style={{ 
                  backgroundColor: "#111827", 
                  border: "1px solid #1f2937", 
                  borderRadius: "12px", 
                  padding: "1rem",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <span style={{ fontSize: "0.65rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "0.25rem" }}>
                    {key}
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: "600", color: extracted[key as keyof ExtractedData] ? "white" : "#374151" }}>
                    {extracted[key as keyof ExtractedData] || "—"}
                  </div>
                  {/* Subtle highlight when updated */}
                  <AnimatePresence>
                    {extracted[key as keyof ExtractedData] && (
                      <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(217,114,11,0.2)", pointerEvents: "none" }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Recommendation Card */}
            <AnimatePresence>
              {showRecommendation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  style={{
                    backgroundColor: "#0d1b11",
                    border: "1px solid #065f46",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    boxShadow: "0 10px 30px rgba(6, 95, 70, 0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "#34d399", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                      {t.call.matchFound}
                    </span>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "#064e3b", color: "#6ee7b7", padding: "2px 8px", borderRadius: "100px" }}>
                      {t.call.confidence}
                    </span>
                  </div>
                  
                  <h4 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.5rem" }}>{t.call.jobRole}</h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", color: "#a7f3d0", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <span>{t.call.center}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <span>{t.call.nextBatch}</span>
                    </div>
                  </div>

                  {callState === "ended" && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed #065f46", fontSize: "0.8rem", color: "#6ee7b7", display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#34d399" }} />
                      {t.call.sentWhatsapp}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </div>

      </div>
      </div>

      {/* Optional: Close Button for testing/escape */}
      <button 
        onClick={onClose}
        style={{
          position: "absolute", top: "2rem", right: "2rem",
          background: "transparent", border: "none", color: "#6b7280", cursor: "pointer"
        }}
      >
        <X size={24} />
      </button>

    </motion.div>
  );
}
