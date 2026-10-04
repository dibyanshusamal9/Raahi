"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PageLoader() {
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Fake loading delay to match the original static pages behavior
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loaded) return null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", zIndex: 9999, backgroundColor: "#111" }}>
      <h2 className="brand-font" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>RAAHI</h2>
      <div style={{ fontFamily: "var(--font-hind)", fontSize: "1.2rem", marginBottom: "0.25rem", color: "rgba(255,255,255,0.9)" }}>
        {t.loading.preparing}
      </div>
      <div style={{ width: "200px", height: "4px", backgroundColor: "#333", borderRadius: "2px", overflow: "hidden", marginTop: "1rem" }}>
        <div style={{ width: "100%", height: "100%", backgroundColor: "var(--color-accent)", animation: "loading-bar 1s infinite linear" }} />
      </div>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
