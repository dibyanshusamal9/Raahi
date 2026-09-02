"use client";

import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
  const { scrollY } = useScroll();
  const navBackground = useTransform(scrollY, [0, 50], ["rgba(0,0,0,0)", "rgba(0,0,0,0.8)"]);

  return (
    <>
      {/* Navbar Scrim for better contrast */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "140px", background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)", zIndex: 40, pointerEvents: "none" }} />
      
      {/* Navbar */}
      <motion.div className="nav-container" style={{ position: "fixed", top: 0, left: 0, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, background: navBackground }}>
        <Link href="/" style={{ display: "flex", flexDirection: "column", textDecoration: "none" }}>
          <div className="text-fluid-logo" style={{ fontFamily: "var(--font-yatra-one)", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>राही</div>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.8rem", fontWeight: 500, letterSpacing: "0.5px", marginTop: "0.25rem", textShadow: "0 1px 3px rgba(0,0,0,0.5)", textTransform: "uppercase" }}>RAAHI - Rural AI Advisor for Household Income</div>
        </Link>
        <div className="mobile-menu-btn">
          <Menu size={32} color="white" />
        </div>
        <div className="nav-links" style={{ color: "white", fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
          <a href="/RAAHI_About_Mission_Vision.html" style={{ transition: "opacity 0.2s", display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "white" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <span className="text-fluid-nav" style={{ fontFamily: "var(--font-hind)", lineHeight: 1 }}>राही के बारे में</span>
            <span className="text-fluid-nav-sub" style={{ opacity: 0.8, marginTop: "0.25rem" }}>About RAAHI</span>
          </a>
          <a href="/RAAHI_Evidence_Gap_Bridge_.html" style={{ transition: "opacity 0.2s", display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "white" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <span className="text-fluid-nav" style={{ fontFamily: "var(--font-hind)", lineHeight: 1 }}>राही कैसे मदद करता है</span>
            <span className="text-fluid-nav-sub" style={{ opacity: 0.8, marginTop: "0.25rem" }}>How RAAHI helps</span>
          </a>
          <a href="/RAAHI_Success_Stories_Illustrated.html" style={{ transition: "opacity 0.2s", display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "white" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <span className="text-fluid-nav" style={{ fontFamily: "var(--font-hind)", lineHeight: 1 }}>सफलता की कहानियाँ</span>
            <span className="text-fluid-nav-sub" style={{ opacity: 0.8, marginTop: "0.25rem" }}>Success stories</span>
          </a>
        </div>
      </motion.div>
    </>
  );
}
