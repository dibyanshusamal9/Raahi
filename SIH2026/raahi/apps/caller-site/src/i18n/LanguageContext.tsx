"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LanguageCode } from "./types";
import { translations } from "./translations";

interface LanguageContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("raahi_language") as LanguageCode;
    if (savedLang && translations[savedLang]) {
      setLanguageState(savedLang);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = language;
      document.documentElement.dir = translations[language].direction;
    }
  }, [language, mounted]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("raahi_language", lang);
  };

  const t = translations[language] || translations.en;

  if (!mounted) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#111", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h2 className="brand-font" style={{ fontSize: "2rem", color: "white", margin: 0, letterSpacing: 0 }}>RAAHI</h2>
        {/* Intentionally blank loading text during SSR to prevent wrong-language flash */}
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className={`lang-${language} dir-${t.direction}`} style={{ display: 'contents' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
