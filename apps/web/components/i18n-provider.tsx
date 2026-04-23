"use client";

import { useEffect } from "react";
import i18n, { detectAndSetLanguage, getSystemLanguage } from "@/i18n";

// Ensure i18n config is imported and initialized
import "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only detect and set language after client mount
    detectAndSetLanguage();

    /**
     * Keep UI language synced with OS/browser language when user enabled follow-system mode.
     */
    const handleSystemLanguageChange = () => {
      const userSelected =
        localStorage.getItem("langbot_language_user_selected") === "true";
      if (userSelected) return;
      i18n.changeLanguage(getSystemLanguage());
    };

    window.addEventListener("languagechange", handleSystemLanguageChange);
    return () => {
      window.removeEventListener("languagechange", handleSystemLanguageChange);
    };
  }, []);

  return <>{children}</>;
}
