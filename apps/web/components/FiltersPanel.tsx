"use client";

// Owner: E — controlled trip basics. Submitting reuses the existing chat
// contract so there is one orchestration path for both form and chat updates.
import { useEffect, useState } from "react";
import type { ChatResponse, TripBrief, TripPlan } from "@trip/shared";

type FormState = {
  destination: string;
  startDate: string;
  endDate: string;
  groupSize: string;
  budgetTotal: string;
  nationality: string;
};

function stateFromBrief(brief: TripBrief): FormState {
  return {
    destination: brief.destination,
    startDate: brief.dates[0],
    endDate: brief.dates[1],
    groupSize: String(brief.groupSize),
    budgetTotal: String(brief.budgetTotal),
    nationality: brief.nationality ?? "",
  };
}

export function FiltersPanel({
  brief,
  onPlan,
}: {
  brief: TripBrief;
  onPlan: (plan: TripPlan) => void;
}) {
  const [form, setForm] = useState(() => stateFromBrief(brief));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(stateFromBrief(brief)), [brief]);

  const changed = JSON.stringify(form) !== JSON.stringify(stateFromBrief(brief));

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaved(false);
    setError(undefined);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !changed) return;

    const groupSize = Number(form.groupSize);
    const budgetTotal = Number(form.budgetTotal);
    if (!Number.isSafeInteger(groupSize) || groupSize < 1) {
      setError("Travellers must be a whole number of at least 1.");
      return;
    }
    if (!Number.isFinite(budgetTotal) || budgetTotal <= 0) {
      setError("Budget must be greater than 0.");
      return;
    }
    if (form.endDate <= form.startDate) {
      setError("End date must be after the start date.");
      return;
    }

    const nextBrief: TripBrief = {
      ...brief,
      destination: form.destination.trim(),
      dates: [form.startDate, form.endDate],
      groupSize,
      budgetTotal,
      ...(form.nationality.trim() ? { nationality: form.nationality.trim() } : {}),
    };
    if (!form.nationality.trim()) delete nextBrief.nationality;

    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripId: brief.tripId,
          message: "Replan using the trip basics submitted in the filters.",
          brief: nextBrief,
        }),
      });
      const data = (await response.json()) as Partial<ChatResponse> & { error?: string };
      if (!response.ok || !data.plan) {
        throw new Error(data.error ?? "Unable to replan this trip.");
      }
      onPlan(data.plan);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to replan this trip.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--left" aria-busy={busy}>
      <h2>Filters</h2>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="destination">
          Destination
        </label>
        <input
          id="destination"
          className="field"
          required
          value={form.destination}
          onChange={(event) => update("destination", event.target.value)}
          placeholder="Search destinations"
        />

        <fieldset className="field-group">
          <legend>Dates</legend>
          <label htmlFor="start-date">Start</label>
          <input
            id="start-date"
            className="field"
            type="date"
            required
            value={form.startDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
          <label htmlFor="end-date">End</label>
          <input
            id="end-date"
            className="field"
            type="date"
            required
            value={form.endDate}
            min={form.startDate}
            onChange={(event) => update("endDate", event.target.value)}
          />
        </fieldset>

        <label className="field-label" htmlFor="travellers">
          Travellers
        </label>
        <input
          id="travellers"
          className="field"
          type="number"
          min="1"
          step="1"
          required
          value={form.groupSize}
          onChange={(event) => update("groupSize", event.target.value)}
        />

        <label className="field-label" htmlFor="budget">
          Budget total (USD)
        </label>
        <input
          id="budget"
          className="field"
          type="number"
          min="1"
          step="1"
          required
          value={form.budgetTotal}
          onChange={(event) => update("budgetTotal", event.target.value)}
        />

        <label className="field-label" htmlFor="nationality">
          Passport / nationality
        </label>
        <input
          id="nationality"
          className="field"
          value={form.nationality}
          onChange={(event) => update("nationality", event.target.value)}
          placeholder="Optional"
        />

        {error && (
          <p className="form-status form-status--error" role="alert">
            {error}
          </p>
        )}
        {saved && !changed && (
          <p className="form-status form-status--success" role="status">
            Plan updated.
          </p>
        )}
        <button className="filters__submit" type="submit" disabled={busy || !changed}>
          {busy ? "Replanning…" : changed ? "Apply & replan" : "Plan is up to date"}
        </button>
      </form>
    </section>
  );
}
