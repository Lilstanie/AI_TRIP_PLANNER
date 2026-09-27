"use client";
import { useRef, useState } from "react";
import { blankDraft, type Draft } from "@/lib/workspace";
import type { DataMode } from "@/lib/workspace/data-mode";
import { DIETARY, INTERESTS } from "@/lib/account/settings";
import { PreferenceList } from "../preferences/PreferenceList";
import { useSegmentIndicator } from "../ui/motion";
import { useAccount } from "./AccountProvider";
import { useSettings } from "./SettingsProvider";

export type SettingsSection = "travel" | "memberships" | "general" | "account";
type Section = SettingsSection;
const SECTIONS: [Section, string][] = [
  ["travel", "Travel profile"],
  ["memberships", "Memberships"],
  ["general", "General"],
  ["account", "Account"],
];

const SYNC_TEXT = {
  local: "Saved in this browser.",
  syncing: "Saving to your account…",
  synced: "Saved to your account.",
  failed: "Could not reach your account; saved in this browser and will retry.",
} as const;

/** Chips that toggle membership in a fixed list; each is a pressed/unpressed button. */
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange(next: T[]): void;
}) {
  return (
    <fieldset className="settings-field">
      <legend>{label}</legend>
      <div className="settings-chips" role="group" aria-label={label}>
        {options.map((option) => {
          const on = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              className="settings-chip"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((item) => item !== option) : [...value, option])}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The travel profile: where trips start, who travels, the budget, the pace, interests, dietary
 * needs and standing preferences. Together they prefill every new trip's facts and preferences.
 */
function TravelProfile() {
  const { settings, update } = useSettings();
  const travel = settings.travel;
  const [homeCity, setHomeCity] = useState(travel.homeCity);
  const [travellers, setTravellers] = useState(travel.travellers?.toString() ?? "");
  const [budget, setBudget] = useState(travel.budget?.toString() ?? "");
  const [pace, setPace] = useState(travel.pace);
  const [interests, setInterests] = useState(travel.interests);
  const [dietary, setDietary] = useState(travel.dietary);
  const [preferences, setPreferences] = useState<Draft>({
    ...blankDraft(),
    preferences: travel.preferences,
  });
  const [saved, setSaved] = useState(false);
  const paceTrack = useRef<HTMLDivElement>(null);
  useSegmentIndicator(paceTrack, pace);
  const travellersNumber = travellers ? Number(travellers) : undefined;
  const budgetNumber = budget ? Number(budget) : undefined;
  const travellersInvalid =
    travellersNumber !== undefined &&
    (!Number.isInteger(travellersNumber) || travellersNumber < 1 || travellersNumber > 20);
  const budgetInvalid = budgetNumber !== undefined && !(budgetNumber > 0);
  const dirty = () => setSaved(false);

  function save() {
    if (travellersInvalid || budgetInvalid) return;
    update({
      travel: {
        homeCity: homeCity.trim(),
        preferences: preferences.preferences ?? [],
        interests,
        dietary,
        ...(pace ? { pace } : {}),
        ...(travellersNumber ? { travellers: travellersNumber } : {}),
        ...(budgetNumber ? { budget: budgetNumber } : {}),
      },
    });
    setSaved(true);
  }

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onChange={dirty}
    >
      <p className="settings-lead">
        Your travel profile fills in every new trip: its facts and its trip preferences, which the
        planner reads. You can change any of them for one trip; trips already planned stay as they
        are.
      </p>
      <label className="settings-field">
        <span>Home city</span>
        <input
          value={homeCity}
          maxLength={120}
          placeholder="e.g. Sydney"
          onChange={(event) => setHomeCity(event.target.value)}
        />
      </label>
      <div className="settings-row">
        <label className="settings-field">
          <span>Travellers</span>
          <input
            inputMode="numeric"
            value={travellers}
            placeholder="e.g. 2"
            aria-invalid={travellersInvalid}
            onChange={(event) => setTravellers(event.target.value.replace(/[^\d]/g, ""))}
          />
          {travellersInvalid && <small className="settings-error">From 1 to 20.</small>}
        </label>
        <label className="settings-field">
          <span>Budget (AUD, whole trip)</span>
          <input
            inputMode="decimal"
            value={budget}
            placeholder="e.g. 4000"
            aria-invalid={budgetInvalid}
            onChange={(event) => setBudget(event.target.value.replace(/[^\d.]/g, ""))}
          />
          {budgetInvalid && <small className="settings-error">Enter an amount above 0.</small>}
        </label>
      </div>
      <fieldset className="settings-field">
        <legend>Pace</legend>
        <div ref={paceTrack} className="segmented settings-segmented" role="group" aria-label="Pace">
          {(
            [
              ["relaxed", "Relaxed"],
              ["balanced", "Balanced"],
              ["packed", "Packed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={pace === value}
              onClick={() => {
                setPace(pace === value ? undefined : value);
                dirty();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <ChipGroup
        label="Interests"
        options={INTERESTS}
        value={interests}
        onChange={(next) => {
          setInterests(next);
          dirty();
        }}
      />
      <ChipGroup
        label="Dietary needs"
        options={DIETARY}
        value={dietary}
        onChange={(next) => {
          setDietary(next);
          dirty();
        }}
      />
      <div className="settings-field">
        <span>Other standing preferences</span>
        <PreferenceList value={preferences} onChange={setPreferences} errors={{}} />
      </div>
      <div className="settings-actions">
        <button type="submit" className="primary" disabled={travellersInvalid || budgetInvalid}>
          Save profile
        </button>
        {saved && (
          <span role="status" className="settings-saved">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}

/** Airline and hotel loyalty programmes, kept for reference. */
function Memberships() {
  const { settings, update } = useSettings();
  const [kind, setKind] = useState<"airline" | "hotel">("airline");
  const [program, setProgram] = useState("");
  const [number, setNumber] = useState("");
  const list = settings.memberships;
  return (
    <div className="settings-form">
      <p className="settings-lead">
        Keep your frequent-flyer and hotel loyalty programmes here so they are to hand when you
        book. The planner does not book, so they are for your reference.
      </p>
      {list.length ? (
        <ul className="settings-list" aria-label="Your memberships">
          {list.map((item, index) => (
            <li key={`${item.program}-${index}`}>
              <span>
                <strong>{item.program}</strong>
                <small>
                  {item.kind === "airline" ? "Airline" : "Hotel"}
                  {item.number ? ` · ${item.number}` : ""}
                </small>
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.program}`}
                onClick={() => update({ memberships: list.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-empty">No memberships yet.</p>
      )}
      <form
        className="settings-row settings-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!program.trim()) return;
          update({
            memberships: [
              ...list,
              { kind, program: program.trim(), ...(number.trim() ? { number: number.trim() } : {}) },
            ],
          });
          setProgram("");
          setNumber("");
        }}
      >
        <label className="settings-field">
          <span>Type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as "airline" | "hotel")}>
            <option value="airline">Airline</option>
            <option value="hotel">Hotel</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Programme</span>
          <input
            value={program}
            maxLength={80}
            placeholder="e.g. Qantas Frequent Flyer"
            onChange={(event) => setProgram(event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>Member number (optional)</span>
          <input value={number} maxLength={40} onChange={(event) => setNumber(event.target.value)} />
        </label>
        <div className="settings-actions">
          <button type="submit" disabled={list.length >= 20 || !program.trim()}>
            Add membership
          </button>
        </div>
      </form>
    </div>
  );
}

function General({ onDataMode }: { onDataMode(mode: DataMode): void }) {
  const { settings, update } = useSettings();
  const appearance = useRef<HTMLDivElement>(null);
  const data = useRef<HTMLDivElement>(null);
  useSegmentIndicator(appearance, settings.appearance);
  useSegmentIndicator(data, settings.dataMode);
  return (
    <div className="settings-form">
      <fieldset className="settings-field">
        <legend>Appearance</legend>
        <div ref={appearance} className="segmented settings-segmented" role="group" aria-label="Appearance">
          {(
            [
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={settings.appearance === value}
              onClick={() => update({ appearance: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="settings-field">
        <legend>Default trip data</legend>
        <div ref={data} className="segmented settings-segmented" role="group" aria-label="Default trip data">
          {(
            [
              ["default", "This site's default"],
              ["live", "Live prices"],
              ["mock", "Sample data"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={settings.dataMode === value}
              onClick={() => {
                update({ dataMode: value });
                if (value !== "default") onDataMode(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <small className="settings-hint">
          Live prices search real hotels and flights and spend the shared monthly allowance; sample
          data spends nothing. The switch in the top bar changes it for this browser.
        </small>
      </fieldset>
      <div className="settings-field">
        <span>Language</span>
        <small className="settings-hint">
          The interface is in English. Chat in any language: the planner replies in yours.
        </small>
      </div>
    </div>
  );
}

function AccountSection() {
  const account = useAccount();
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "working" | "failed">("idle");
  const [problem, setProblem] = useState("");

  if (account.status === "local")
    return (
      <div className="settings-form">
        <p className="settings-lead">
          Accounts are not set up on this site, so this is a single-user workspace: chats, trips and
          settings stay in this browser and do not sync to other devices.
        </p>
      </div>
    );
  if (account.status === "loading")
    return <p className="settings-lead" role="status">Checking your account…</p>;
  if (account.status === "signed-out")
    return (
      <div className="settings-form">
        <p className="settings-lead">
          Sign in to keep your chats, trips and settings in your account and open them on any
          device. What is in this browser now is added to your account the first time you sign in.
        </p>
        <div className="settings-actions">
          <button type="button" className="primary" onClick={account.signIn}>
            Sign in
          </button>
          <button type="button" onClick={account.signUp}>
            Create account
          </button>
        </div>
      </div>
    );

  const { signOut } = account;
  async function remove() {
    setDeleting("working");
    setProblem("");
    const response = await fetch("/api/account", { method: "DELETE" }).catch(() => undefined);
    if (response?.ok) {
      await signOut();
      return;
    }
    const body = await response?.json().catch(() => undefined);
    setProblem(body?.error ?? "Your account could not be deleted. Try again.");
    setDeleting("failed");
  }

  return (
    <div className="settings-form">
      <div className="settings-profile">
        {account.imageUrl ? (
          // Clerk hosts the avatar; it is the person's own picture, not decoration.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.imageUrl} alt="" width={40} height={40} />
        ) : (
          <span className="settings-profile__initial" aria-hidden="true">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>
          <strong>{account.name}</strong>
          {account.email && <small>{account.email}</small>}
        </span>
      </div>
      <p className="settings-lead">
        Your chats, trips and settings sync to this account. If two devices change the same trip,
        the later change is kept. Signing out leaves this browser&apos;s copy in place.
      </p>
      <div className="settings-actions">
        <button type="button" onClick={account.manage}>
          Manage account
        </button>
        <a className="settings-link-button" href="/api/account/export" download>
          Export my data
        </a>
        <button type="button" onClick={() => void account.signOut()}>
          Sign out
        </button>
      </div>
      <div className="settings-danger">
        {deleting === "idle" || deleting === "failed" ? (
          <button type="button" className="settings-danger__button" onClick={() => setDeleting("confirm")}>
            Delete account and data
          </button>
        ) : (
          <>
            <p>
              This deletes your account and every chat, trip and setting stored in it. It cannot be
              undone. This browser&apos;s copy stays until you clear it.
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-danger__button"
                disabled={deleting === "working"}
                onClick={() => void remove()}
              >
                {deleting === "working" ? "Deleting…" : "Delete permanently"}
              </button>
              <button type="button" disabled={deleting === "working"} onClick={() => setDeleting("idle")}>
                Keep my account
              </button>
            </div>
          </>
        )}
        {problem && (
          <p role="alert" className="settings-error">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}

/** The Settings dialog's body; the workspace Dialog supplies the title and close button. */
export function SettingsDialog({
  initial = "travel",
  onDataMode,
}: {
  initial?: Section;
  onDataMode(mode: DataMode): void;
}) {
  const [section, setSection] = useState<Section>(initial);
  const { syncState } = useSettings();
  const tabs = useRef<HTMLDivElement>(null);
  useSegmentIndicator(tabs, section);
  return (
    <div className="settings">
      <div ref={tabs} className="segmented settings-tabs" role="tablist" aria-label="Settings sections">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={section === id}
            aria-controls="settings-panel"
            tabIndex={section === id ? 0 : -1}
            onClick={() => setSection(id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              const index = SECTIONS.findIndex(([item]) => item === id);
              const next = SECTIONS[(index + (event.key === "ArrowRight" ? 1 : SECTIONS.length - 1)) % SECTIONS.length]![0];
              setSection(next);
              document.getElementById(`settings-tab-${next}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        key={section}
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${section}`}
        className="tab-panel-enter"
      >
        {section === "travel" && <TravelProfile />}
        {section === "memberships" && <Memberships />}
        {section === "general" && <General onDataMode={onDataMode} />}
        {section === "account" && <AccountSection />}
      </div>
      <p className="settings-sync" role="status">
        {SYNC_TEXT[syncState]}
      </p>
    </div>
  );
}
