"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneCall } from "lucide-react";

export default function HeroSequence() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // The total sequence is 20s.
  // Times: [0s, 4s, 7s, 7.5s, 10s, 11s, 16s, 17s, 20s]
  // normalized to 0-1:
  // t0 = 0
  // t1 = 0.20 (4s) - Billboard enters
  // t2 = 0.35 (7s) - Rider brakes
  // t3 = 0.375 (7.5s) - Full stop
  // t4 = 0.50 (10s) - Crossfade starts
  // t5 = 0.55 (11s) - Crossfade ends, Phone UI starts
  // t6 = 0.80 (16s) - Crossfade back starts
  // t7 = 0.85 (17s) - Crossfade back ends, road resumes
  // t8 = 1.0 (20s) - Loop completes
  
  const T = [0, 0.2, 0.35, 0.375, 0.5, 0.55, 0.8, 0.85, 1];

  const commonTransition = {
    duration: 20,
    repeat: Infinity,
    ease: "linear" as const,
    times: T
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "var(--color-sky)", overflow: "hidden" }}>
      
      {/* BACKGROUND SKY & SUN */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "60%",
        background: "linear-gradient(to bottom, var(--color-sky) 0%, #1a3245 40%, var(--color-sun) 100%)",
      }} />
      <div style={{
        position: "absolute", bottom: "40%", left: "70%", width: "120px", height: "120px",
        borderRadius: "50%", background: "var(--color-sun)", filter: "blur(4px)",
        transform: "translateY(50%)"
      }} />

      {/* ROAD SCENE (BLURS DURING PHONE) */}
      <motion.div
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
        animate={{
          filter: [
            "blur(0px) grayscale(0%)",
            "blur(0px) grayscale(0%)",
            "blur(0px) grayscale(0%)",
            "blur(0px) grayscale(0%)",
            "blur(0px) grayscale(0%)",
            "blur(8px) grayscale(40%)",
            "blur(8px) grayscale(40%)",
            "blur(0px) grayscale(0%)",
            "blur(0px) grayscale(0%)"
          ],
          opacity: [1, 1, 1, 1, 1, 0.6, 0.6, 1, 1]
        }}
        transition={commonTransition}
      >
        {/* PARALLAX HILLS */}
        <motion.div 
          style={{
            position: "absolute", bottom: "40%", left: 0, width: "200%", height: "20%",
            display: "flex", alignItems: "flex-end", opacity: 0.8
          }}
          animate={{ x: ["0%", "-10%", "-20%", "-20.5%", "-20.5%", "-20.5%", "-20.5%", "-20.5%", "-30%"] }}
          transition={commonTransition}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{
              width: "20%", height: i % 2 === 0 ? "80%" : "60%", backgroundColor: "var(--color-field)",
              borderRadius: "100% 100% 0 0", margin: "0 -2%"
            }} />
          ))}
        </motion.div>

        {/* PARALLAX FIELDS */}
        <motion.div 
          style={{
            position: "absolute", bottom: "35%", left: 0, width: "200%", height: "5%",
            backgroundColor: "var(--color-field)", zIndex: 1
          }}
        />

        {/* THE ROAD */}
        <motion.div style={{
          position: "absolute", bottom: 0, left: 0, width: "200%", height: "35%", zIndex: 2,
          display: "flex", flexDirection: "column"
        }}>
          <div style={{ width: "100%", height: "100%", backgroundColor: "var(--color-road)", position: "relative" }}>
            {/* Dashed lines representing motion */}
            <motion.div 
              style={{
                position: "absolute", top: "50%", left: 0, width: "100%", height: "4px",
                backgroundImage: "linear-gradient(to right, white 50%, transparent 50%)",
                backgroundSize: "100px 100%", opacity: 0.3
              }}
              animate={{ backgroundPositionX: ["0px", "-400px", "-800px", "-820px", "-820px", "-820px", "-820px", "-820px", "-1220px"] }}
              transition={commonTransition}
            />
          </div>
        </motion.div>

        {/* THE BILLBOARD */}
        <motion.div
          style={{
            position: "absolute", bottom: "35%", left: "100%", width: "250px", height: "150px",
            zIndex: 3, transformOrigin: "bottom left"
          }}
          animate={{
            x: ["0vw", "0vw", "-60vw", "-65vw", "-65vw", "-65vw", "-65vw", "-65vw", "-120vw"],
            y: [0, 0, 0, 0, 0, 0, 0, 0, 0]
          }}
          transition={commonTransition}
        >
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div style={{ position: "absolute", bottom: "-40px", left: "40px", width: "10px", height: "40px", backgroundColor: "#5c4033" }} />
            <div style={{ position: "absolute", bottom: "-40px", right: "40px", width: "10px", height: "40px", backgroundColor: "#5c4033" }} />
            <div style={{
              width: "100%", height: "100%", backgroundColor: "var(--color-paper)",
              borderRadius: "4px", border: "8px solid #5c4033", padding: "12px",
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.1)"
            }}>
              <h2 className="brand-font" style={{ fontSize: "2.5rem", color: "var(--color-sky)", lineHeight: 1, letterSpacing: "-0.05em" }}>RAAHI</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--color-field)", fontWeight: 700 }}>अपना रास्ता, अपनी कमाई</p>
              <div style={{ marginTop: "8px", backgroundColor: "var(--color-accent)", color: "white", padding: "4px 12px", borderRadius: "100px", fontWeight: "bold", fontSize: "1.1rem" }}>
                1800-123-4567
              </div>
            </div>
          </div>
        </motion.div>

        {/* THE RIDER & BIKE */}
        <motion.div
          style={{
            position: "absolute", bottom: "10%", left: "20%", width: "120px", height: "120px", zIndex: 4
          }}
          animate={{
            rotate: [0, 0, 0, -10, -10, -10, -10, -10, 0],
            y: [0, -2, 0, 5, 5, 5, 5, 5, 0]
          }}
          transition={{ ...commonTransition, ease: "easeInOut" }}
        >
          {/* Simple Vector Representation of Rider */}
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            {/* Wheels */}
            <circle cx="20" cy="80" r="15" fill="#222" />
            <circle cx="80" cy="80" r="15" fill="#222" />
            {/* Bike Body */}
            <path d="M 20 80 L 40 50 L 70 50 L 80 80" fill="none" stroke="#D9720B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Rider Body */}
            <path d="M 50 50 L 45 20 L 60 25" fill="none" stroke="#16283A" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            {/* Helmet */}
            <circle cx="45" cy="15" r="10" fill="#16283A" />
          </svg>

          {/* Skid mark (draws out) */}
          <motion.div
            style={{ position: "absolute", bottom: 0, right: "100%", height: "4px", backgroundColor: "white", opacity: 0.6, transformOrigin: "right" }}
            animate={{ width: ["0px", "0px", "0px", "100px", "100px", "100px", "100px", "0px", "0px"] }}
            transition={commonTransition}
          />
          {/* Dust */}
          <motion.div
            style={{ position: "absolute", bottom: "-10px", right: "-10px", width: "40px", height: "40px", backgroundColor: "var(--color-field)", borderRadius: "50%", filter: "blur(8px)" }}
            animate={{
              opacity: [0, 0, 0, 0.8, 0.8, 0.8, 0.8, 0, 0],
              scale: [0.5, 0.5, 0.5, 1.5, 1.5, 1.5, 1.5, 0.5, 0.5],
              x: [0, 0, 0, -20, -20, -20, -20, 0, 0]
            }}
            transition={commonTransition}
          />
        </motion.div>

      </motion.div>

      {/* PHONE CLOSE-UP SCENE */}
      <motion.div
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10,
          display: "flex", justifyContent: "center", alignItems: "flex-end"
        }}
        animate={{
          opacity: [0, 0, 0, 0, 0, 1, 1, 0, 0],
          y: ["20%", "20%", "20%", "20%", "20%", "0%", "0%", "20%", "20%"]
        }}
        transition={commonTransition}
      >
        <div style={{
          width: "340px", height: "85%", backgroundColor: "var(--color-paper)",
          borderTopLeftRadius: "40px", borderTopRightRadius: "40px",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)", border: "14px solid #111", borderBottom: "none",
          display: "flex", flexDirection: "column", overflow: "hidden", position: "relative"
        }}>
          {/* Status Bar */}
          <div style={{ height: "30px", backgroundColor: "var(--color-sky)", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", color: "white", fontSize: "0.75rem", fontWeight: "bold" }}>
            <span>18:30</span>
            <span style={{ display: "flex", gap: "4px" }}>
              <div style={{ width: "16px", height: "10px", backgroundColor: "white", borderRadius: "2px" }} />
            </span>
          </div>

          <div style={{ flex: 1, padding: "2rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
            
            <h3 className="brand-font" style={{ color: "var(--color-sky)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>RAAHI</h3>
            <p style={{ color: "var(--color-field)", fontWeight: 600, fontSize: "1.1rem", marginBottom: "2rem" }}>1800-123-4567</p>

            {/* Calling State (Ringing vs Connected) */}
            <motion.div
              style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              animate={{
                opacity: [0, 0, 0, 0, 0, 1, 1, 0, 0] // Only visible during phone scene
              }}
              transition={commonTransition}
            >
              {/* Ringing / Connected dot */}
              <motion.div
                style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "var(--color-accent)", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "2rem", color: "white" }}
                animate={{
                  scale: [1, 1, 1, 1, 1, 1.1, 1, 1, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(217, 114, 11, 0.4)",
                    "0 0 0 0 rgba(217, 114, 11, 0.4)",
                    "0 0 0 0 rgba(217, 114, 11, 0.4)",
                    "0 0 0 0 rgba(217, 114, 11, 0.4)",
                    "0 0 0 0 rgba(217, 114, 11, 0.4)",
                    "0 0 0 20px rgba(217, 114, 11, 0)",
                    "0 0 0 0 rgba(217, 114, 11, 0)",
                    "0 0 0 0 rgba(217, 114, 11, 0)",
                    "0 0 0 0 rgba(217, 114, 11, 0)"
                  ]
                }}
                transition={{ ...commonTransition, ease: "easeOut" }}
              >
                <PhoneCall size={32} />
              </motion.div>

              {/* Status Text */}
              <motion.div
                style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--color-sky)", marginBottom: "2rem" }}
              >
                <motion.span
                  animate={{ opacity: [1, 1, 1, 1, 1, 1, 0, 0, 0] }} // Ringing
                  transition={{ ...commonTransition, times: [0, 0.2, 0.35, 0.375, 0.5, 0.55, 0.65, 0.85, 1] }}
                  style={{ position: "absolute", transform: "translateX(-50%)" }}
                >
                  Ringing...
                </motion.span>
                <motion.span
                  animate={{ opacity: [0, 0, 0, 0, 0, 0, 1, 1, 0] }} // Connected
                  transition={{ ...commonTransition, times: [0, 0.2, 0.35, 0.375, 0.5, 0.55, 0.65, 0.85, 1] }}
                  style={{ position: "absolute", transform: "translateX(-50%)", color: "var(--color-field)" }}
                >
                  Connected
                </motion.span>
              </motion.div>

              {/* Waveform and Caption */}
              <motion.div
                style={{ marginTop: "3rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
                animate={{ opacity: [0, 0, 0, 0, 0, 0, 1, 1, 0] }}
                transition={{ ...commonTransition, times: [0, 0.2, 0.35, 0.375, 0.5, 0.55, 0.65, 0.85, 1] }}
              >
                {/* Waveform */}
                <div style={{ display: "flex", gap: "4px", height: "40px", alignItems: "center", marginBottom: "1.5rem" }}>
                  {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((scale, i) => (
                    <motion.div
                      key={i}
                      style={{ width: "6px", backgroundColor: "var(--color-accent)", borderRadius: "3px" }}
                      animate={{ height: ["10px", `${scale * 10}px`, "10px"] }}
                      transition={{ duration: 0.5 + (i * 0.1), repeat: Infinity, ease: "easeInOut" }}
                    />
                  ))}
                </div>

                {/* Captions */}
                <p style={{ color: "var(--color-sky)", fontWeight: 700, fontSize: "1.2rem", textAlign: "center", lineHeight: 1.3 }}>नमस्ते! मैं राही हूँ।<br/>मैं आपकी कैसे मदद कर सकती हूँ?</p>
                <p style={{ color: "#666", fontSize: "1rem", textAlign: "center", marginTop: "8px", lineHeight: 1.3 }}>Hello, I'm RAAHI.<br/>How can I help you today?</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
