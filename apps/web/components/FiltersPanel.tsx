"use client";

import { useEffect, useMemo, useState } from "react";
import type { TripBrief, TripPlan } from "@trip/shared";
import { useLanguage } from "@/components/LanguageContext";
import {
  ParticipantEditor,
  createParticipants,
  type Participant,
} from "@/components/ParticipantEditor";
import { requestTripUpdate } from "@/lib/chatStream";

const UI_PREFS_KEY = "ai-trip-planner.ui-preferences.v2";

function destinationCurrency(destination: string): string | undefined {
  const value = destination.toLowerCase();
  if (/japan|tokyo|kyoto|osaka|日本|东京|京都/.test(value)) return "JPY";
  if (/australia|sydney|melbourne|澳大利亚|悉尼|墨尔本/.test(value)) return "AUD";
  if (/china|beijing|shanghai|中国|北京|上海/.test(value)) return "CNY";
  if (/united kingdom|london|英国|伦敦/.test(value)) return "GBP";
  if (/france|germany|italy|spain|paris|rome|法国|德国|意大利|西班牙/.test(value)) return "EUR";
  if (/new zealand|auckland|queenstown|新西兰/.test(value)) return "NZD";
  if (/singapore|新加坡/.test(value)) return "SGD";
  if (/south korea|seoul|韩国|首尔/.test(value)) return "KRW";
  if (/thailand|bangkok|泰国|曼谷/.test(value)) return "THB";
  return undefined;
}

export function FiltersPanel({
  brief,
  onPlan,
  onClose,
}: {
  brief: TripBrief;
  onPlan: (plan: TripPlan) => void;
  onClose?: () => void;
}) {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState(brief);
  const [participants, setParticipants] = useState<Participant[]>(() =>
    createParticipants(brief.groupSize),
  );
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();

  useEffect(() => {
    setDraft(brief);
    setParticipants((current) =>
      current.length === brief.groupSize ? current : createParticipants(brief.groupSize),
    );
  }, [brief]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_PREFS_KEY) ?? "{}") as {
        participants?: Participant[];
        displayCurrency?: string;
      };
      if (saved.participants?.length === brief.groupSize) setParticipants(saved.participants);
      if (saved.displayCurrency) setDisplayCurrency(saved.displayCurrency);
    } catch {
      localStorage.removeItem(UI_PREFS_KEY);
    }
  }, [brief.groupSize]);

  useEffect(() => {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ participants, displayCurrency }));
  }, [participants, displayCurrency]);

  const currencies = useMemo(() => {
    const local = destinationCurrency(draft.destination);
    return [...new Set(["USD", "AUD", "CNY", ...(local ? [local] : [])])];
  }, [draft.destination]);
  const valid =
    draft.destination.trim().length > 0 &&
    Date.parse(draft.dates[1]) > Date.parse(draft.dates[0]) &&
    draft.budgetTotal > 0 &&
    participants.length > 0 &&
    participants.every((person) => person.label.trim());

  function update<K extends keyof TripBrief>(key: K, value: TripBrief[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(undefined);
  }

  async function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    const nextBrief: TripBrief = { ...draft, groupSize: participants.length };
    const message =
      language === "zh"
        ? `确认筛选并重新规划：目的地 ${nextBrief.destination}，日期 ${nextBrief.dates[0]} 至 ${nextBrief.dates[1]}，${nextBrief.groupSize} 人，总预算 USD ${nextBrief.budgetTotal}。`
        : `Replan with confirmed filters: destination ${nextBrief.destination}, dates ${nextBrief.dates[0]} to ${nextBrief.dates[1]}, ${nextBrief.groupSize} people, total budget USD ${nextBrief.budgetTotal}.`;
    setBusy(true);
    setError(undefined);
    setProgress(t("Updating plan…"));
    try {
      const response = await requestTripUpdate({
        tripId: nextBrief.tripId,
        message,
        brief: nextBrief,
        onProgress: (frame) =>
          setProgress(
            `${frame.agent}: ${t(frame.type === "agent_started" ? "Running" : frame.type === "agent_completed" ? "Complete" : "Needs attention")}`,
          ),
      });
      onPlan(response.plan);
      setProgress(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this trip.");
      setProgress(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel panel--left filters-panel" onSubmit={applyFilters}>
      <header className="panel-title">
        <div>
          <span className="eyebrow">TripBrief</span>
          <h2>{t("Trip filters")}</h2>
          <p className="helper">{t("Agents plan against the confirmed values below.")}</p>
        </div>
        {onClose && (
          <button type="button" className="icon-button close-filter" onClick={onClose}>
            ×
          </button>
        )}
      </header>

      <fieldset>
        <legend>{t("Destination")}</legend>
        <input
          value={draft.destination}
          onChange={(event) => update("destination", event.target.value)}
        />
      </fieldset>

      <fieldset>
        <legend>{t("Dates")}</legend>
        <div className="field-grid">
          <label>
            {t("Start")}
            <input
              type="date"
              value={draft.dates[0]}
              onChange={(event) => update("dates", [event.target.value, draft.dates[1]])}
            />
          </label>
          <label>
            {t("End")}
            <input
              type="date"
              min={draft.dates[0]}
              value={draft.dates[1]}
              onChange={(event) => update("dates", [draft.dates[0], event.target.value])}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("Travellers")}</legend>
        <ParticipantEditor participants={participants} onChange={setParticipants} />
      </fieldset>

      <fieldset>
        <legend>{t("Agent budget")}</legend>
        <div className="budget-input-row">
          <label>
            {t("Display currency")}
            <select
              value={displayCurrency}
              onChange={(event) => setDisplayCurrency(event.target.value)}
            >
              {currencies.map((currency) => (
                <option value={currency} key={currency}>
                  {currency}
                  {currency === destinationCurrency(draft.destination) ? " · local" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            USD
            <input
              type="number"
              min="1"
              step="50"
              value={draft.budgetTotal}
              onChange={(event) => update("budgetTotal", Number(event.target.value))}
            />
          </label>
        </div>
        <small className="currency-warning">
          {t("Agent cost calculations currently remain in whole-trip USD.")}
        </small>
      </fieldset>

      <fieldset>
        <legend>{t("Nationality")}</legend>
        <input
          placeholder={t("Optional passport nationality")}
          value={draft.nationality ?? ""}
          onChange={(event) => update("nationality", event.target.value || undefined)}
        />
      </fieldset>

      <p className="memory-note">
        {t(
          "Participant roles and display currency stay on this device until the shared contract is expanded.",
        )}
      </p>
      {progress && (
        <p className="form-status" aria-live="polite">
          {progress}
        </p>
      )}
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      {!valid && (
        <p className="form-status form-status--error">
          {language === "zh"
            ? "请填写有效的目的地、日期、参与者和预算。"
            : "Enter a valid destination, date range, participant and budget."}
        </p>
      )}
      <button type="submit" className="primary-button full-width" disabled={!valid || busy}>
        {busy ? t("Updating plan…") : t("Apply filters and replan")}
      </button>
    </form>
  );
}
