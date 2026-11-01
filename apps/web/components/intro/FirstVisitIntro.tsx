"use client";
import { SettingsProvider } from "../account/SettingsProvider";
import { LocaleProvider, useLocale } from "../account/LocaleProvider";
import { BrandMark } from "../workspace/BrandMark";
import { LanguageToggle } from "../workspace/LanguageToggle";
import { AssistantIcon, ASSISTANT_ROLE_KEYS } from "../chat/assistants";
import { ASSISTANT_ORDER } from "@/lib/chat/assistant-order";
import type { MessageKey } from "@/lib/i18n/locale";

const STEPS: [MessageKey, MessageKey][] = [
  ["introStepTellTitle", "introStepTellBody"],
  ["introStepTeamTitle", "introStepTeamBody"],
  ["introStepAdjustTitle", "introStepAdjustBody"],
];

export function FirstVisitIntro({ onStart }: { onStart(): void }) {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <IntroContent onStart={onStart} />
      </LocaleProvider>
    </SettingsProvider>
  );
}

function IntroContent({ onStart }: { onStart(): void }) {
  const { t } = useLocale();
  return (
    <div className="intro">
      <header className="intro__bar">
        <BrandMark />
        <div className="topbar-actions">
          <LanguageToggle />
        </div>
      </header>
      <main className="intro__main">
        <section className="intro__hero">
          <h1 className="intro__title">{t("introHeadline")}</h1>
          <p className="intro__lead">{t("introLead")}</p>
          <button type="button" className="primary intro__start" onClick={onStart}>
            {t("introStart")}
          </button>
        </section>
        <section className="intro__team glass-float" aria-label={t("introTeamLabel")}>
          <ul className="intro__members">
            {ASSISTANT_ORDER.map((id) => (
              <li key={id} className="intro__member">
                <AssistantIcon id={id} />
                <span>{t(ASSISTANT_ROLE_KEYS[id])}</span>
              </li>
            ))}
          </ul>
        </section>
        <ol className="intro__steps">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="intro__step">
              <span className="intro__step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h2>{t(title)}</h2>
              <p>{t(body)}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
