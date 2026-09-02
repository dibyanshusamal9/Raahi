"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link href="/RAAHI_About_Mission_Vision.html">
            <span className="text-fluid-nav">राही के बारे में</span>
            <span className="text-fluid-nav-sub">About RAAHI</span>
          </Link>
          <Link href="/RAAHI_Evidence_Gap_Bridge_.html">
            <span className="text-fluid-nav">राही कैसे मदद करता है</span>
            <span className="text-fluid-nav-sub">How RAAHI helps</span>
          </Link>
          <Link href="/RAAHI_Success_Stories_Illustrated.html">
            <span className="text-fluid-nav">सफलता की कहानियाँ</span>
            <span className="text-fluid-nav-sub">Success stories</span>
          </Link>
        </div>
      </header>
      {/* ================= END NAVBAR ================= */}
    </>
  );
}
