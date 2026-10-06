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
import { SUPPORTED_CURRENCIES } from "@trip/shared";
import { CurrencyNotice } from "./CurrencyNotice";
import type { MessageKey } from "@/lib/i18n/locale";

/**
 * Settings follows Mindtrip's settings page: a quiet list of sections on the left, one section on
 * the right made of labelled rows with a Change action. Only what this planner can actually do is
 * here; Mindtrip's voice, price alerts, notifications and cookie sections have no counterpart.
 */
export type SettingsSection = "profile" | "account" | "personalization" | "region" | "connected";
type Section = SettingsSection;
type AccountModalProps = { onAccountModal(open: () => void): void };
const SECTIONS: [Section, MessageKey][] = [
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

const STYLE_LABEL: Record<(typeof COMMUNICATION_STYLES)[number], MessageKey> = {
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

import {
  SettingRow,
  Segmented,
  ChipGroup,
  Switch,
  MemoryRow,
  TextEditor,
} from "./SettingsControls";

function ProfileSection({ onAccountModal }: AccountModalProps) {
  const { t, notice: localizeNotice } = useLocale();
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
              {t("Change profile photo")}
            </button>
          </span>
        </div>
      ) : (
        <p className="settings-lead">
          {account.status === "local"
            ? t("Accounts are not set up on this site, so your profile stays in this browser.")
            : t(
                "Sign in to add your name and photo. Your location is kept in this browser until then.",
              )}
        </p>
      )}
      {signedIn && (
        <>
          <label className="settings-field">
            <span>{t("First name")}</span>
            <input
              value={first}
              maxLength={60}
              onChange={(event) => setFirst(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>{t("Last name")}</span>
            <input value={last} maxLength={60} onChange={(event) => setLast(event.target.value)} />
          </label>
        </>
      )}
      <label className="settings-field">
        <span>{t("Location")}</span>
        <input
          value={location}
          maxLength={120}
          placeholder={t("e.g. Sydney, Australia")}
          onChange={(event) => setLocation(event.target.value)}
        />
        <small className="settings-hint">{t("New trips start from here.")}</small>
      </label>
      <div className="settings-actions">
        <button
          type="submit"
          className="settings-pill settings-pill--ink"
          disabled={!dirty || state === "saving"}
        >
          {state === "saving" ? t("Saving…") : t("Save")}
        </button>
        {state === "saved" && !dirty && (
          <span role="status" className="settings-saved">
            {t("Saved.")}
          </span>
        )}
        {state === "failed" && (
          <span role="alert" className="settings-error">
            {t("Your name could not be saved. Try again.")}
          </span>
        )}
      </div>
    </form>
  );
}

function AccountSection({ onAccountModal }: AccountModalProps) {
  const { t, notice: localizeNotice } = useLocale();
  const account = useAccount();
  const { settings, update } = useSettings();
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "working" | "failed">("idle");
  const [problem, setProblem] = useState("");

  const theme = (
    <SettingRow label={t("Theme")} value={t(THEME_LABEL[settings.appearance])}>
      {() => (
        <Segmented
          label={t("Theme")}
          options={[
            ["system", t("System")],
            ["light", t("Light")],
            ["dark", t("Dark")],
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
            {t("Checking your account…")}
          </p>
        ) : account.status === "signed-out" ? (
          <>
            <p className="settings-lead">
              {t(
                "Sign in to keep your chats, trips and settings in your account and open them on any device. What is in this browser now is added to your account the first time you sign in.",
              )}
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-pill--ink"
                onClick={() => onAccountModal(account.signIn)}
              >
                {t("Sign in")}
              </button>
              <button
                type="button"
                className="settings-pill"
                onClick={() => onAccountModal(account.signUp)}
              >
                {t("Create account")}
              </button>
            </div>
          </>
        ) : (
          <p className="settings-lead">
            {t(
              "Accounts are not set up on this site, so this is a single-user workspace: chats, trips and settings stay in this browser and do not sync to other devices.",
            )}
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
        label={t("Email")}
        value={
          <>
            {account.email ?? t("No email")}{" "}
            {account.emailVerified && <span className="settings-verified">{t("(verified)")}</span>}
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
              {t("Manage email and password")}
            </button>
          </div>
        )}
      </SettingRow>
      {theme}
      <SettingRow
        label={t("Your data")}
        value={t("Chats, trips and settings sync to this account.")}
        action="Export"
      >
        {() => (
          <div className="settings-actions">
            <a className="settings-pill" href="/api/account/export" download>
              {t("Download a copy")}
            </a>
          </div>
        )}
      </SettingRow>
      <div className="settings-actions">
        <button type="button" className="settings-pill" onClick={() => void signOut()}>
          {t("Sign out")}
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
              {t("Delete my account")}
            </button>
            <p>{t("Permanently delete the account and remove access to your data.")}</p>
          </>
        ) : (
          <>
            <p>
              {t(
                "This deletes your account and every chat, trip and setting stored in it. It cannot be undone. This browser's copy stays until you clear it.",
              )}
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-danger__confirm"
                disabled={deleting === "working"}
                onClick={() => void remove()}
              >
                {deleting === "working" ? t("Deleting…") : t("Delete permanently")}
              </button>
              <button
                type="button"
                className="settings-pill"
                disabled={deleting === "working"}
                onClick={() => setDeleting("idle")}
              >
                {t("Keep my account")}
              </button>
            </div>
          </>
        )}
        {problem && (
          <p role="alert" className="settings-error">
            {localizeNotice(problem)}
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
  const { t, notice: localizeNotice } = useLocale();
  const [kind, setKind] = useState<"airline" | "hotel">("airline");
  const [program, setProgram] = useState("");
  const [number, setNumber] = useState("");
  return (
    <div className="settings-form">
      {list.length > 0 && (
        <ul className="settings-list" aria-label={t("Your memberships")}>
          {list.map((item, index) => (
            <li key={`${item.program}-${index}`}>
              <span>
                <strong>{item.program}</strong>
                <small>
                  {item.kind === "airline" ? t("Airline") : t("Hotel")}
                  {item.number ? ` · ${item.number}` : ""}
                </small>
              </span>
              <button
                type="button"
                className="settings-pill"
                aria-label={t("Remove {v0}", { v0: item.program })}
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                {t("Remove")}
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
          aria-label={t("Type")}
          value={kind}
          onChange={(event) => setKind(event.target.value as "airline" | "hotel")}
        >
          <option value="airline">{t("Airline")}</option>
          <option value="hotel">{t("Hotel")}</option>
        </select>
        <input
          aria-label={t("Programme")}
          value={program}
          maxLength={80}
          placeholder={t("e.g. Qantas Frequent Flyer")}
          onChange={(event) => setProgram(event.target.value)}
        />
        <input
          aria-label={t("Member number (optional)")}
          value={number}
          maxLength={40}
          placeholder={t("Member number")}
          onChange={(event) => setNumber(event.target.value)}
        />
        <button
          type="submit"
          className="settings-pill settings-pill--ink"
          disabled={list.length >= 20 || !program.trim()}
        >
          {t("Add membership")}
        </button>
      </form>
    </div>
  );
}

function PersonalizationSection() {
  const { t, notice: localizeNotice } = useLocale();
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
        <h3 id="settings-style">{t("Communication style")}</h3>
        <p className="settings-hint">
          {t("Choose how you would like the planner to talk with you.")}
        </p>
        <select
          className="settings-select"
          aria-label={t("Communication style")}
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
              {t(STYLE_LABEL[style])}
            </option>
          ))}
        </select>
      </section>
      <section className="settings-block settings-block--switch" aria-labelledby="settings-memory">
        <div>
          <h3 id="settings-memory">{t("Long-term memory")}</h3>
          <p className="settings-hint">
            {t(
              "Let the planner remember preferences you mention in chat, such as your pace or what you eat, and use them in later plans. When off, it will not save or use anything it learns in chat.",
            )}
          </p>
        </div>
        <Switch
          label={t("Long-term memory")}
          checked={settings.assistant.memory}
          onChange={(memory) => update({ assistant: { ...settings.assistant, memory } })}
        />
      </section>

      <p className="settings-hint">
        {t(
          "What the planner knows about you fills in every new trip. You can change any of it for one trip, and trips already planned stay as they are.",
        )}
      </p>
      <h3 className="settings-group">{t("Identity")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🏡"
          label={t("Home base")}
          value={travel.homeCity}
          question={t("Where do your trips usually start?")}
        >
          {(close) => (
            <TextEditor
              label={t("Home base")}
              initial={travel.homeCity}
              onSave={(homeCity) => {
                setTravel({ homeCity });
                close();
              }}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("Travel party")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="👥"
          label={t("Travellers")}
          value={
            travel.travellers
              ? `${travel.travellers} ${travel.travellers === 1 ? t("person") : t("people")}`
              : ""
          }
          question={t("How many people usually travel?")}
        >
          {(close) => (
            <TextEditor
              label={t("Travellers")}
              numeric
              initial={travel.travellers?.toString() ?? ""}
              validate={(value) =>
                value &&
                !(Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20)
                  ? t("From 1 to 20.")
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
      <h3 className="settings-group">{t("Travel style")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🐢"
          label={t("Pace")}
          value={travel.pace ? t(PACE_LABEL[travel.pace]) : ""}
          question={t("How full should a day be?")}
        >
          {() => (
            <Segmented
              label={t("Pace")}
              options={[
                ["relaxed", t("Relaxed")],
                ["balanced", t("Balanced")],
                ["packed", t("Packed")],
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
          label={t("Interests")}
          value={travel.interests.map((item) => t(item)).join("、")}
          question={t("What do you love doing on a trip?")}
        >
          {() => (
            <ChipGroup
              label={t("Interests")}
              options={INTERESTS}
              value={travel.interests}
              onChange={(interests) => setTravel({ interests })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("Food")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🥗"
          label={t("Dietary")}
          value={travel.dietary.map((item) => t(item)).join("、")}
          question={t(
            "Any dietary restrictions or allergies? (e.g., vegetarian, gluten-free, nut allergies)",
          )}
        >
          {() => (
            <ChipGroup
              label={t("Dietary needs")}
              options={DIETARY}
              value={travel.dietary}
              onChange={(dietary) => setTravel({ dietary })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("Budget")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="💰"
          label={t("Trip budget")}
          value={
            travel.budget
              ? t("AUD {v0} for a whole trip", { v0: travel.budget.toLocaleString("en-AU") })
              : ""
          }
          question={t("What do you usually spend on a trip, in AUD?")}
        >
          {(close) => (
            <TextEditor
              label={t("Budget (AUD, whole trip)")}
              numeric
              initial={travel.budget?.toString() ?? ""}
              validate={(value) =>
                value && !(Number(value) > 0) ? t("Enter an amount above 0.") : undefined
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
      <h3 className="settings-group">{t("Accommodation")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🏨"
          label={t("Loyalty")}
          value={settings.memberships.map((item) => item.program).join(", ")}
          question={t("Any frequent-flyer or hotel loyalty programmes?")}
        >
          {() => (
            <Loyalty
              list={settings.memberships}
              onChange={(memberships) => update({ memberships })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("Other preferences")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="📝"
          label={t("Standing preferences")}
          value={travel.preferences.join("; ")}
          question={t("Anything else every trip should respect?")}
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
                  {t("Save preferences")}
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
  const { locale, t, notice: localizeNotice } = useLocale();
  const languageLabel = locale === "zh" ? "简体中文" : "English";
  return (
    <div className="settings-form">
      <SettingRow label={t("Language")} value={languageLabel}>
        {() => (
          <Segmented
            label={t("Language")}
            options={
              [
                ["en", "English"],
                ["zh", "简体中文"],
              ] as const
            }
            value={locale}
            onChange={(language) => language && update({ language })}
          />
        )}
      </SettingRow>
      <p className="settings-hint">
        {locale === "zh"
          ? "界面使用简体中文。你可以用任何语言聊天，规划助手会使用你的语言回复。"
          : t(
              "The interface follows this setting. Chat in any language: the planner replies in yours.",
            )}
      </p>
      <SettingRow label={t("Region")} value={`🇦🇺 ${t("Australia")}`} />
      <h3 className="settings-group">{t("Advanced")}</h3>
      <SettingRow label={t("Display currency")} value={settings.displayCurrency}>
        {() => (
          <Segmented
            label={t("Display currency")}
            options={SUPPORTED_CURRENCIES.map((code) => [code, code] as const)}
            value={settings.displayCurrency}
            onChange={(displayCurrency) => displayCurrency && update({ displayCurrency })}
          />
        )}
      </SettingRow>
      <CurrencyNotice currency={settings.displayCurrency} />
      <SettingRow label={t("Units")} value={t("Metric (°C, km)")} />
      <SettingRow label={t("Trip data")} value={t(DATA_LABEL[settings.dataMode])}>
        {() => (
          <>
            <Segmented
              label={t("Default trip data")}
              options={[
                ["default", t("This site's default")],
                ["live", t("Live prices")],
                ["mock", t("Sample data")],
              ]}
              value={settings.dataMode}
              onChange={(value) => {
                if (!value) return;
                update({ dataMode: value });
                if (value !== "default") onDataMode(value);
              }}
            />
            <small className="settings-hint">
              {t(
                "Live prices search real hotels and flights and spend the shared monthly allowance; sample data spends nothing. The data switch in the workspace changes it for this browser.",
              )}
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
  const { t, notice: localizeNotice } = useLocale();
  const account = useAccount();
  if (account.status !== "signed-in")
    return (
      <p className="settings-lead">
        {account.status === "local"
          ? t("Accounts are not set up on this site.")
          : t("Sign in with Google, GitHub or Apple to connect an account.")}
      </p>
    );
  return (
    <div className="settings-form">
      <p className="settings-hint">{t("Accounts you can sign in with.")}</p>
      {account.connected.length ? (
        account.connected.map((item) => (
          <SettingRow
            key={`${item.provider}-${item.email ?? ""}`}
            label={PROVIDER_LABEL[item.provider.replace(/^oauth_/, "")] ?? item.provider}
            value={item.email ?? t("Connected")}
          />
        ))
      ) : (
        <p className="settings-empty">{t("No connected accounts. You sign in with email.")}</p>
      )}
      <div className="settings-actions">
        <button
          type="button"
          className="settings-pill"
          onClick={() => onAccountModal(account.manage)}
        >
          {t("Connect or disconnect")}
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
  const { t, notice: localizeNotice } = useLocale();
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
