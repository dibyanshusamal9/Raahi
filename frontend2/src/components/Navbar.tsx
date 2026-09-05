"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES, LanguageCode } from "@/i18n/types";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const currentLangName = LANGUAGES.find(l => l.code === language)?.nativeName || "English";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* ================= GLOBAL NAVBAR ================= */}
      <div className="navbar-scrim"></div>
      <header id="global-nav-container" className={`nav-container ${scrolled ? "scrolled" : ""}`}>
        <Link href="/" className="nav-logo-link">
          <div className="text-fluid-logo">राही</div>
          <div className="text-fluid-logo-sub">RAAHI - Rural AI Advisor for Household Income</div>
        </Link>
        <div className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</div>
        <div className={`nav-links ${menuOpen ? "open" : ""}`} id="nav-links">
          <Link href="/about" style={{ display: "flex", alignItems: "center" }}>
            <span className="text-fluid-nav">{t.nav.about}</span>
          </Link>
          <Link href="/help" style={{ display: "flex", alignItems: "center" }}>
            <span className="text-fluid-nav">{t.nav.help}</span>
          </Link>
          <Link href="/stories" style={{ display: "flex", alignItems: "center" }}>
            <span className="text-fluid-nav">{t.nav.stories}</span>
          </Link>

          {/* Language Selector */}
          <div className="language-selector" style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Select language"
              className="lang-btn"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "0.5rem 1rem", borderRadius: "100px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-hind)" }}
            >
              {currentLangName} ▼
            </button>
            {dropdownOpen && (
              <div className="lang-dropdown" style={{ position: "absolute", top: "100%", insetInlineEnd: 0, marginTop: "1rem", backgroundColor: "white", color: "#111", borderRadius: "8px", padding: "0.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.25rem", width: "min(340px, calc(100vw - 24px))", maxHeight: "60vh", overflowY: "auto", overflowX: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", zIndex: 100 }}>
                {LANGUAGES.map((l) => (
                  <button 
                    key={l.code} 
                    onClick={() => {
                      setLanguage(l.code);
                      setDropdownOpen(false);
                      setMenuOpen(false);
                    }}
                    dir={l.code === "ur" || l.code === "sd" || l.code === "ks" ? "rtl" : "ltr"}
                    style={{ background: language === l.code ? "#f3f4f6" : "transparent", border: "none", padding: "0.5rem 1rem", textAlign: "start", cursor: "pointer", borderRadius: "4px", fontSize: "0.9rem", fontFamily: "var(--font-hind)", fontWeight: language === l.code ? "bold" : "normal", overflowWrap: "anywhere" }}
                  >
                    {l.nativeName} — {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* ================= END NAVBAR ================= */}
    </>
  );
}
