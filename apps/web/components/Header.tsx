"use client";

import { useLanguage } from "@/components/LanguageContext";

export function Header() {
  const { language, toggle, t } = useLanguage();

  return (
    <header className="header">
      <span className="brand">
        <span className="brand-mark" aria-hidden>
          ✦
        </span>
        AI Travel Planner
      </span>
      <nav>
        <span>{t("Saved trips")}</span>
        <span>{t("My trips")}</span>
        <button
          type="button"
          className="language-toggle"
          onClick={toggle}
          aria-label={language === "en" ? "切换到中文" : "Switch to English"}
        >
          {language === "en" ? "中文" : "EN"}
        </button>
        <span className="user-badge" aria-label="User profile">
          U
        </span>
      </nav>
    </header>
  );
}
