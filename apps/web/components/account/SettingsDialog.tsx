"use client";
import { useRef, useState, type ReactNode } from "react";
import { COMMUNICATION_STYLES } from "@trip/shared";
import { blankDraft, type Draft } from "@/lib/workspace";
import type { DataMode } from "@/lib/workspace/data-mode";
import { DIETARY, INTERESTS, type UserSettings } from "@/lib/account/settings";
import { PreferenceList } from "../preferences/PreferenceList";
import { useSegmentIndicator } from "../ui/motion";
import { useAccount } from "./AccountProvider";
import { useSettings } from "./SettingsProvider";
import { useLocale } from "./LocaleProvider";

/**
 * Settings follows Mindtrip's settings page: a quiet list of sections on the left, one section on
 * the right made of labelled rows with a Change action. Only what this planner can actually do is
 * here; Mindtrip's voice, price alerts, notifications and cookie sections have no counterpart.
 */
export type SettingsSection = "profile" | "account" | "personalization" | "region" | "connected";
type Section = SettingsSection;
type AccountModalProps = { onAccountModal(open: () => void): void };
const SECTIONS: [Section, string][] = [
  ["profile", "Edit profile"],
  ["account", "Your account"],
  ["personalization", "Personalization"],
  ["region", "Language & region"],
  ["connected", "Connected accounts"],
];

const SYNC_TEXT = {
  local: "Saved in this browser.",
  syncing: "Saving to your account…",
  synced: "Saved to your account.",
  failed: "Could not reach your account; saved in this browser and will retry.",
} as const;

const STYLE_LABEL: Record<(typeof COMMUNICATION_STYLES)[number], string> = {
  neutral: "Neutral",
  friendly: "Friendly",
  concise: "Concise",
  detailed: "Detailed",
};
const PACE_LABEL = { relaxed: "Relaxed", balanced: "Balanced", packed: "Packed" } as const;
const THEME_LABEL = { system: "System preference", light: "Light", dark: "Dark" } as const;
const DATA_LABEL = {
  default: "This site's default",
  live: "Live prices",
  mock: "Sample data",
} as const;

/** One labelled row with its current value and a Change button that opens its editor below. */
function SettingRow({
  label,
  value,
  action = "Change",
  children,
}: {
  label: string;
  value: ReactNode;
  action?: string;
  children?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  return (
    <div className="settings-row-item">
      <div className="settings-row-item__line">
        <div className="settings-row-item__text">
          <strong>{label}</strong>
          <span>{value}</span>
        </div>
        {children && (
          <button
            type="button"
            className="settings-pill"
            aria-expanded={open}
            aria-label={`${t(open ? "Close" : action)} ${label}`}
            onClick={() => setOpen(!open)}
          >
            {t(open ? "Done" : action)}
          </button>
        )}
      </div>
      {open && children && (
        <div className="settings-row-item__editor">{children(() => setOpen(false))}</div>
      )}
    </div>
  );
}

/** A segmented choice that applies at once. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | undefined;
  onChange(next: T | undefined): void;
}) {
  const track = useRef<HTMLDivElement>(null);
  useSegmentIndicator(track, value);
  return (
    <div ref={track} className="segmented settings-segmented" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

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
    <div className="settings-chips" role="group" aria-label={label}>
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className="settings-chip"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((item) => item !== option) : [...value, option])
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** Mindtrip's on/off switch: a black pill with a white knob. */
function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="settings-switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

/**
 * One fact the planner keeps about the traveller, in Mindtrip's memory-row style: an emoji, a bold
 * label and the value. An empty fact asks its question instead and offers Answer.
 */
function MemoryRow({
  icon,
  label,
  value,
  question,
  children,
}: {
  icon: string;
  label: string;
  value: string;
  question: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const empty = !value;
  return (
    <li className="memory-row" data-empty={empty || undefined}>
      <button
        type="button"
        className="memory-row__main"
        aria-expanded={open}
        aria-label={`Edit ${label}`}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{icon}</span>
        <span>
          <strong>{label}:</strong> {empty ? question : value}
        </span>
      </button>
      {empty && !open && (
        <button type="button" className="memory-row__answer" onClick={() => setOpen(true)}>
          Answer
        </button>
      )}
      {open && <div className="memory-row__editor">{children(() => setOpen(false))}</div>}
    </li>
  );
}

/** A one-line text or number editor with Save, used inside a memory or setting row. */
function TextEditor({
  label,
  initial,
  numeric,
  validate,
  onSave,
}: {
  label: string;
  initial: string;
  numeric?: boolean;
  validate?(value: string): string | undefined;
  onSave(value: string): void;
}) {
  const [value, setValue] = useState(initial);
  const problem = validate?.(value);
  return (
    <form
      className="settings-inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (!problem) onSave(value.trim());
      }}
    >
      <input
        aria-label={label}
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        aria-invalid={Boolean(problem) || undefined}
        onChange={(event) =>
          setValue(numeric ? event.target.value.replace(/[^\d.]/g, "") : event.target.value)
        }
      />
      <button
        type="submit"
        className="settings-pill settings-pill--ink"
        disabled={Boolean(problem)}
      >
        Save
      </button>
      {problem && <small className="settings-error">{problem}</small>}
    </form>
  );
}

function ProfileSection({ onAccountModal }: AccountModalProps) {
  const account = useAccount();
  const { settings, update } = useSettings();
  const signedIn = account.status === "signed-in" ? account : undefined;
  const [first, setFirst] = useState(signedIn?.firstName ?? "");
  const [last, setLast] = useState(signedIn?.lastName ?? "");
  const [location, setLocation] = useState(settings.travel.homeCity);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirty =
    location.trim() !== settings.travel.homeCity ||
    (signedIn !== undefined &&
      (first.trim() !== signedIn.firstName || last.trim() !== signedIn.lastName));

  async function save() {
    setState("saving");
    update({ travel: { ...settings.travel, homeCity: location.trim() } });
    try {
      if (signedIn) await signedIn.rename(first.trim(), last.trim());
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {signedIn ? (
        <div className="settings-profile">
          {signedIn.imageUrl ? (
            // Clerk hosts the avatar; it is the person's own picture, not decoration.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedIn.imageUrl} alt="" width={40} height={40} />
          ) : (
            <span className="settings-profile__initial" aria-hidden="true">
              {signedIn.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>
            <strong>{signedIn.name}</strong>
            <button
              type="button"
              className="settings-text-button"
              onClick={() => onAccountModal(signedIn.manage)}
            >
              Change profile photo
            </button>
          </span>
        </div>
      ) : (
        <p className="settings-lead">
          {account.status === "local"
            ? "Accounts are not set up on this site, so your profile stays in this browser."
            : "Sign in to add your name and photo. Your location is kept in this browser until then."}
        </p>
      )}
      {signedIn && (
        <>
          <label className="settings-field">
            <span>First name</span>
            <input
              value={first}
              maxLength={60}
              onChange={(event) => setFirst(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Last name</span>
            <input value={last} maxLength={60} onChange={(event) => setLast(event.target.value)} />
          </label>
        </>
      )}
      <label className="settings-field">
        <span>Location</span>
        <input
          value={location}
          maxLength={120}
          placeholder="e.g. Sydney, Australia"
          onChange={(event) => setLocation(event.target.value)}
        />
        <small className="settings-hint">New trips start from here.</small>
      </label>
      <div className="settings-actions">
        <button
          type="submit"
          className="settings-pill settings-pill--ink"
          disabled={!dirty || state === "saving"}
        >
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        {state === "saved" && !dirty && (
          <span role="status" className="settings-saved">
            Saved.
          </span>
        )}
        {state === "failed" && (
          <span role="alert" className="settings-error">
            Your name could not be saved. Try again.
          </span>
        )}
      </div>
    </form>
  );
}

function AccountSection({ onAccountModal }: AccountModalProps) {
  const account = useAccount();
  const { settings, update } = useSettings();
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "working" | "failed">("idle");
  const [problem, setProblem] = useState("");

  const theme = (
    <SettingRow label="Theme" value={THEME_LABEL[settings.appearance]}>
      {() => (
        <Segmented
          label="Theme"
          options={[
            ["system", "System"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          value={settings.appearance}
          onChange={(value) => value && update({ appearance: value })}
        />
      )}
    </SettingRow>
  );

  if (account.status !== "signed-in")
    return (
      <div className="settings-form">
        {account.status === "loading" ? (
          <p className="settings-lead" role="status">
            Checking your account…
          </p>
        ) : account.status === "signed-out" ? (
          <>
            <p className="settings-lead">
              Sign in to keep your chats, trips and settings in your account and open them on any
              device. What is in this browser now is added to your account the first time you sign
              in.
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-pill--ink"
                onClick={() => onAccountModal(account.signIn)}
              >
                Sign in
              </button>
              <button
                type="button"
                className="settings-pill"
                onClick={() => onAccountModal(account.signUp)}
              >
                Create account
              </button>
            </div>
          </>
        ) : (
          <p className="settings-lead">
            Accounts are not set up on this site, so this is a single-user workspace: chats, trips
            and settings stay in this browser and do not sync to other devices.
          </p>
        )}
        {theme}
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
      <SettingRow
        label="Email"
        value={
          <>
            {account.email ?? "No email"}{" "}
            {account.emailVerified && <span className="settings-verified">(verified)</span>}
          </>
        }
        action="Manage"
      >
        {() => (
          <div className="settings-actions">
            <button
              type="button"
              className="settings-pill"
              onClick={() => onAccountModal(account.manage)}
            >
              Manage email and password
            </button>
          </div>
        )}
      </SettingRow>
      {theme}
      <SettingRow
        label="Your data"
        value="Chats, trips and settings sync to this account."
        action="Export"
      >
        {() => (
          <div className="settings-actions">
            <a className="settings-pill" href="/api/account/export" download>
              Download a copy
            </a>
          </div>
        )}
      </SettingRow>
      <div className="settings-actions">
        <button type="button" className="settings-pill" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      <div className="settings-danger">
        {deleting === "idle" || deleting === "failed" ? (
          <>
            <button
              type="button"
              className="settings-danger__button"
              onClick={() => setDeleting("confirm")}
            >
              Delete my account
            </button>
            <p>Permanently delete the account and remove access to your data.</p>
          </>
        ) : (
          <>
            <p>
              This deletes your account and every chat, trip and setting stored in it. It cannot be
              undone. This browser&apos;s copy stays until you clear it.
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-danger__confirm"
                disabled={deleting === "working"}
                onClick={() => void remove()}
              >
                {deleting === "working" ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                className="settings-pill"
                disabled={deleting === "working"}
                onClick={() => setDeleting("idle")}
              >
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

/** Airline and hotel loyalty programmes, kept for reference. */
function Loyalty({
  list,
  onChange,
}: {
  list: UserSettings["memberships"];
  onChange(next: UserSettings["memberships"]): void;
}) {
  const [kind, setKind] = useState<"airline" | "hotel">("airline");
  const [program, setProgram] = useState("");
  const [number, setNumber] = useState("");
  return (
    <div className="settings-form">
      {list.length > 0 && (
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
                className="settings-pill"
                aria-label={`Remove ${item.program}`}
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="settings-inline settings-inline--wrap"
        onSubmit={(event) => {
          event.preventDefault();
          if (!program.trim()) return;
          onChange([
            ...list,
            { kind, program: program.trim(), ...(number.trim() ? { number: number.trim() } : {}) },
          ]);
          setProgram("");
          setNumber("");
        }}
      >
        <select
          aria-label="Type"
          value={kind}
          onChange={(event) => setKind(event.target.value as "airline" | "hotel")}
        >
          <option value="airline">Airline</option>
          <option value="hotel">Hotel</option>
        </select>
        <input
          aria-label="Programme"
          value={program}
          maxLength={80}
          placeholder="e.g. Qantas Frequent Flyer"
          onChange={(event) => setProgram(event.target.value)}
        />
        <input
          aria-label="Member number (optional)"
          value={number}
          maxLength={40}
          placeholder="Member number"
          onChange={(event) => setNumber(event.target.value)}
        />
        <button
          type="submit"
          className="settings-pill settings-pill--ink"
          disabled={list.length >= 20 || !program.trim()}
        >
          Add membership
        </button>
      </form>
    </div>
  );
}

function PersonalizationSection() {
  const { settings, update } = useSettings();
  const travel = settings.travel;
  const setTravel = (next: Partial<UserSettings["travel"]>) =>
    update({ travel: { ...travel, ...next } });
  const [preferences, setPreferences] = useState<Draft>({
    ...blankDraft(),
    preferences: travel.preferences,
  });

  return (
    <div className="settings-form">
      <section className="settings-block" aria-labelledby="settings-style">
        <h3 id="settings-style">Communication style</h3>
        <p className="settings-hint">Choose how you would like the planner to talk with you.</p>
        <select
          className="settings-select"
          aria-label="Communication style"
          value={settings.assistant.style}
          onChange={(event) =>
            update({
              assistant: {
                ...settings.assistant,
                style: event.target.value as UserSettings["assistant"]["style"],
              },
            })
          }
        >
          {COMMUNICATION_STYLES.map((style) => (
            <option key={style} value={style}>
              {STYLE_LABEL[style]}
            </option>
          ))}
        </select>
      </section>
      <section className="settings-block settings-block--switch" aria-labelledby="settings-memory">
        <div>
          <h3 id="settings-memory">Long-term memory</h3>
          <p className="settings-hint">
            Let the planner remember preferences you mention in chat, such as your pace or what you
            eat, and use them in later plans. When off, it will not save or use anything it learns
            in chat.
          </p>
        </div>
        <Switch
          label="Long-term memory"
          checked={settings.assistant.memory}
          onChange={(memory) => update({ assistant: { ...settings.assistant, memory } })}
        />
      </section>

      <p className="settings-hint">
        What the planner knows about you fills in every new trip. You can change any of it for one
        trip, and trips already planned stay as they are.
      </p>
      <h3 className="settings-group">Identity</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🏡"
          label="Home base"
          value={travel.homeCity}
          question="Where do your trips usually start?"
        >
          {(close) => (
            <TextEditor
              label="Home base"
              initial={travel.homeCity}
              onSave={(homeCity) => {
                setTravel({ homeCity });
                close();
              }}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Travel party</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="👥"
          label="Travellers"
          value={
            travel.travellers
              ? `${travel.travellers} ${travel.travellers === 1 ? "person" : "people"}`
              : ""
          }
          question="How many people usually travel?"
        >
          {(close) => (
            <TextEditor
              label="Travellers"
              numeric
              initial={travel.travellers?.toString() ?? ""}
              validate={(value) =>
                value &&
                !(Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20)
                  ? "From 1 to 20."
                  : undefined
              }
              onSave={(value) => {
                const { travellers: _old, ...rest } = travel;
                update({ travel: value ? { ...rest, travellers: Number(value) } : rest });
                close();
              }}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Travel style</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🐢"
          label="Pace"
          value={travel.pace ? PACE_LABEL[travel.pace] : ""}
          question="How full should a day be?"
        >
          {() => (
            <Segmented
              label="Pace"
              options={[
                ["relaxed", "Relaxed"],
                ["balanced", "Balanced"],
                ["packed", "Packed"],
              ]}
              value={travel.pace}
              onChange={(pace) => {
                const { pace: old, ...rest } = travel;
                update({ travel: pace && pace !== old ? { ...rest, pace } : rest });
              }}
            />
          )}
        </MemoryRow>
        <MemoryRow
          icon="✨"
          label="Interests"
          value={travel.interests.join(", ")}
          question="What do you love doing on a trip?"
        >
          {() => (
            <ChipGroup
              label="Interests"
              options={INTERESTS}
              value={travel.interests}
              onChange={(interests) => setTravel({ interests })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Food</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🥗"
          label="Dietary"
          value={travel.dietary.join(", ")}
          question="Any dietary restrictions or allergies? (e.g., vegetarian, gluten-free, nut allergies)"
        >
          {() => (
            <ChipGroup
              label="Dietary needs"
              options={DIETARY}
              value={travel.dietary}
              onChange={(dietary) => setTravel({ dietary })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Budget</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="💰"
          label="Trip budget"
          value={
            travel.budget ? `AUD ${travel.budget.toLocaleString("en-AU")} for a whole trip` : ""
          }
          question="What do you usually spend on a trip, in AUD?"
        >
          {(close) => (
            <TextEditor
              label="Budget (AUD, whole trip)"
              numeric
              initial={travel.budget?.toString() ?? ""}
              validate={(value) =>
                value && !(Number(value) > 0) ? "Enter an amount above 0." : undefined
              }
              onSave={(value) => {
                const { budget: _old, ...rest } = travel;
                update({ travel: value ? { ...rest, budget: Number(value) } : rest });
                close();
              }}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Accommodation</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🏨"
          label="Loyalty"
          value={settings.memberships.map((item) => item.program).join(", ")}
          question="Any frequent-flyer or hotel loyalty programmes?"
        >
          {() => (
            <Loyalty
              list={settings.memberships}
              onChange={(memberships) => update({ memberships })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">Other preferences</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="📝"
          label="Standing preferences"
          value={travel.preferences.join("; ")}
          question="Anything else every trip should respect?"
        >
          {(close) => (
            <div className="settings-form">
              <PreferenceList value={preferences} onChange={setPreferences} errors={{}} />
              <div className="settings-actions">
                <button
                  type="button"
                  className="settings-pill settings-pill--ink"
                  onClick={() => {
                    setTravel({ preferences: preferences.preferences ?? [] });
                    close();
                  }}
                >
                  Save preferences
                </button>
              </div>
            </div>
          )}
        </MemoryRow>
      </ul>
    </div>
  );
}

function RegionSection({ onDataMode }: { onDataMode(mode: DataMode): void }) {
  const { settings, update } = useSettings();
  const { t } = useLocale();
  const languageLabel = settings.language === "zh-CN" ? "简体中文" : "English";
  return (
    <div className="settings-form">
      <SettingRow label={t("Language")} value={languageLabel}>
        {() => (
          <Segmented
            label={t("Language")}
            options={
              [
                ["en", "English"],
                ["zh-CN", "简体中文"],
              ] as const
            }
            value={settings.language}
            onChange={(language) => language && update({ language })}
          />
        )}
      </SettingRow>
      <p className="settings-hint">
        {settings.language === "zh-CN"
          ? "界面使用简体中文。你可以用任何语言聊天，规划助手会使用你的语言回复。"
          : "The interface follows this setting. Chat in any language: the planner replies in yours."}
      </p>
      <SettingRow label={t("Region")} value={`🇦🇺 ${t("Australia")}`} />
      <h3 className="settings-group">{t("Advanced")}</h3>
      <SettingRow label={t("Currency")} value="AUD" />
      <SettingRow label={t("Units")} value={t("Metric (°C, km)")} />
      <SettingRow label={t("Trip data")} value={DATA_LABEL[settings.dataMode]}>
        {() => (
          <>
            <Segmented
              label="Default trip data"
              options={[
                ["default", "This site's default"],
                ["live", "Live prices"],
                ["mock", "Sample data"],
              ]}
              value={settings.dataMode}
              onChange={(value) => {
                if (!value) return;
                update({ dataMode: value });
                if (value !== "default") onDataMode(value);
              }}
            />
            <small className="settings-hint">
              Live prices search real hotels and flights and spend the shared monthly allowance;
              sample data spends nothing. The switch in the top bar changes it for this browser.
            </small>
          </>
        )}
      </SettingRow>
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
};

function ConnectedSection({ onAccountModal }: AccountModalProps) {
  const account = useAccount();
  if (account.status !== "signed-in")
    return (
      <p className="settings-lead">
        {account.status === "local"
          ? "Accounts are not set up on this site."
          : "Sign in with Google, GitHub or Apple to connect an account."}
      </p>
    );
  return (
    <div className="settings-form">
      <p className="settings-hint">Accounts you can sign in with.</p>
      {account.connected.length ? (
        account.connected.map((item) => (
          <SettingRow
            key={`${item.provider}-${item.email ?? ""}`}
            label={PROVIDER_LABEL[item.provider.replace(/^oauth_/, "")] ?? item.provider}
            value={item.email ?? "Connected"}
          />
        ))
      ) : (
        <p className="settings-empty">No connected accounts. You sign in with email.</p>
      )}
      <div className="settings-actions">
        <button
          type="button"
          className="settings-pill"
          onClick={() => onAccountModal(account.manage)}
        >
          Connect or disconnect
        </button>
      </div>
    </div>
  );
}

/** The Settings dialog's body; the workspace Dialog supplies the title and close button. */
export function SettingsDialog({
  initial = "personalization",
  onDataMode,
  onAccountModal,
}: {
  initial?: Section;
  onDataMode(mode: DataMode): void;
} & AccountModalProps) {
  const [section, setSection] = useState<Section>(initial);
  const { syncState } = useSettings();
  const { t } = useLocale();
  const title = t(SECTIONS.find(([id]) => id === section)![1]);
  return (
    <div className="settings">
      <nav className="settings-nav" aria-label={t("Settings sections")}>
        <ul role="tablist" aria-orientation="vertical">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                role="tab"
                className="settings-tab"
                id={`settings-tab-${id}`}
                aria-selected={section === id}
                aria-controls="settings-panel"
                tabIndex={section === id ? 0 : -1}
                onClick={() => setSection(id)}
                onKeyDown={(event) => {
                  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
                  if (!keys.includes(event.key)) return;
                  event.preventDefault();
                  const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
                  const index = SECTIONS.findIndex(([item]) => item === id);
                  const next =
                    SECTIONS[(index + (forward ? 1 : SECTIONS.length - 1)) % SECTIONS.length]![0];
                  setSection(next);
                  document.getElementById(`settings-tab-${next}`)?.focus();
                }}
              >
                {t(label)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div
        key={section}
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${section}`}
        className="settings-panel tab-panel-enter"
      >
        <h3 className="settings-panel__title">{title}</h3>
        {section === "profile" && <ProfileSection onAccountModal={onAccountModal} />}
        {section === "account" && <AccountSection onAccountModal={onAccountModal} />}
        {section === "personalization" && <PersonalizationSection />}
        {section === "region" && <RegionSection onDataMode={onDataMode} />}
        {section === "connected" && <ConnectedSection onAccountModal={onAccountModal} />}
        <p className="settings-sync" role="status">
          {t(SYNC_TEXT[syncState])}
        </p>
      </div>
    </div>
  );
}
