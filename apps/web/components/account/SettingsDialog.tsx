"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { COMMUNICATION_STYLES, MAX_ASSISTANT_NAME_LENGTH, type AssistantId } from "@trip/shared";
import { blankDraft, type Draft } from "@/lib/workspace";
import type { DataMode } from "@/lib/workspace/data-mode";
import { DIETARY, INTERESTS, type UserSettings } from "@/lib/account/settings";
import { memoryDisplay } from "@/lib/account/memory-display";
import { PreferenceList } from "../preferences/PreferenceList";
import { ASSISTANT_ROLE_KEYS } from "../chat/assistants";
import { ASSISTANT_ORDER, nameTaken } from "../chat/assistant-names";
import { useAccount } from "./AccountProvider";
import { useSettings } from "./SettingsProvider";
import { useLocale } from "./LocaleProvider";
import { SUPPORTED_CURRENCIES } from "@trip/shared";
import { CurrencyNotice } from "./CurrencyNotice";
import { keyForText, type MessageKey } from "@/lib/i18n/locale";
import { failureNotice, type Notice } from "@/lib/i18n/notice";

export type SettingsSection = "profile" | "account" | "personalization" | "region" | "connected";
type Section = SettingsSection;
type AccountModalProps = { onAccountModal(open: () => void): void };
const SECTIONS: [Section, MessageKey][] = [
  ["profile", "editProfile"],
  ["account", "yourAccount"],
  ["personalization", "personalization"],
  ["region", "languageRegion"],
  ["connected", "connectedAccounts"],
];

const SYNC_TEXT = {
  local: "savedInThisBrowserTitle",
  syncing: "savingToYourAccount",
  synced: "savedToYourAccount",
  failed: "couldNotReachYourAccount",
} as const;

const STYLE_LABEL: Record<(typeof COMMUNICATION_STYLES)[number], MessageKey> = {
  neutral: "neutral",
  friendly: "friendly",
  concise: "concise",
  detailed: "detailed",
};
const PACE_LABEL = { relaxed: "relaxed", balanced: "balanced", packed: "packed" } as const;
const THEME_LABEL = { system: "systemPreference", light: "light", dark: "dark" } as const;
const DATA_LABEL = {
  default: "thisSiteSDefault",
  live: "livePrices",
  mock: "sampleData",
} as const;
const MEMORY_CATEGORY_LABEL: Record<string, MessageKey> = {
  dietary: "dietaryNeeds",
  pace: "pace",
  interests: "interests",
  accessibility: "accessibilityNeeds",
  accommodation: "accommodationPreferences",
  departure_city: "usualDepartureCity",
  "accommodation.minRating": "accommodationPreferences",
  "accommodation.freeCancellation": "accommodationPreferences",
};

import {
  SettingRow,
  Segmented,
  ChipGroup,
  MemoryRow,
  TextEditor,
  Switch,
} from "./SettingsControls";

function ProfileSection({ onAccountModal }: AccountModalProps) {
  const { t } = useLocale();
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
              {t("changeProfilePhoto")}
            </button>
          </span>
        </div>
      ) : (
        <p className="settings-lead">
          {account.status === "local" ? t("accountsAreNotSetUpOn") : t("signInToAddYour")}
        </p>
      )}
      {signedIn && (
        <>
          <label className="settings-field">
            <span>{t("firstName")}</span>
            <input
              value={first}
              maxLength={60}
              onChange={(event) => setFirst(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>{t("lastName")}</span>
            <input value={last} maxLength={60} onChange={(event) => setLast(event.target.value)} />
          </label>
        </>
      )}
      <label className="settings-field">
        <span>{t("location")}</span>
        <input
          value={location}
          maxLength={120}
          placeholder={t("eGSydneyAustralia")}
          onChange={(event) => setLocation(event.target.value)}
        />
        <small className="settings-hint">{t("newTripsStartFromHere")}</small>
      </label>
      <div className="settings-actions">
        <button
          type="submit"
          className="settings-pill settings-pill--ink"
          disabled={!dirty || state === "saving"}
        >
          {state === "saving" ? t("saving") : t("save")}
        </button>
        {state === "saved" && !dirty && (
          <span role="status" className="settings-saved">
            {t("saved")}
          </span>
        )}
        {state === "failed" && (
          <span role="alert" className="settings-error">
            {t("yourNameCouldNotBe")}
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
  const [problem, setProblem] = useState<Notice>();

  const theme = (
    <SettingRow label={t("theme")} value={t(THEME_LABEL[settings.appearance])}>
      {() => (
        <Segmented
          label={t("theme")}
          options={[
            ["system", t("system")],
            ["light", t("light")],
            ["dark", t("dark")],
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
            {t("checkingYourAccount")}
          </p>
        ) : account.status === "signed-out" ? (
          <>
            <p className="settings-lead">{t("signInToKeepYour")}</p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-pill--ink"
                onClick={() => onAccountModal(account.signIn)}
              >
                {t("signIn")}
              </button>
              <button
                type="button"
                className="settings-pill"
                onClick={() => onAccountModal(account.signUp)}
              >
                {t("createAccount")}
              </button>
            </div>
          </>
        ) : (
          <p className="settings-lead">{t("accountsAreNotSetUp")}</p>
        )}
        {theme}
      </div>
    );

  const { signOut } = account;
  async function remove() {
    setDeleting("working");
    setProblem(undefined);
    const response = await fetch("/api/account", { method: "DELETE" }).catch(() => undefined);
    if (response?.ok) {
      await signOut();
      return;
    }
    const body = await response?.json().catch(() => undefined);
    setProblem(failureNotice(body, { key: "yourAccountCouldNotBe" }));
    setDeleting("failed");
  }

  return (
    <div className="settings-form">
      <SettingRow
        label={t("email")}
        value={
          <>
            {account.email ?? t("noEmail")}{" "}
            {account.emailVerified && <span className="settings-verified">{t("verified")}</span>}
          </>
        }
        action="manage"
      >
        {() => (
          <div className="settings-actions">
            <button
              type="button"
              className="settings-pill"
              onClick={() => onAccountModal(account.manage)}
            >
              {t("manageEmailAndPassword")}
            </button>
          </div>
        )}
      </SettingRow>
      {theme}
      <SettingRow label={t("yourData")} value={t("chatsTripsAndSettingsSync")} action="export">
        {() => (
          <div className="settings-actions">
            <a className="settings-pill" href="/api/account/export" download>
              {t("downloadACopy")}
            </a>
          </div>
        )}
      </SettingRow>
      <div className="settings-actions">
        <button type="button" className="settings-pill" onClick={() => void signOut()}>
          {t("signOut")}
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
              {t("deleteMyAccount")}
            </button>
            <p>{t("permanentlyDeleteTheAccountAnd")}</p>
          </>
        ) : (
          <>
            <p>{t("thisDeletesYourAccountAnd")}</p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-pill settings-danger__confirm"
                disabled={deleting === "working"}
                onClick={() => void remove()}
              >
                {deleting === "working" ? t("deleting") : t("deletePermanently")}
              </button>
              <button
                type="button"
                className="settings-pill"
                disabled={deleting === "working"}
                onClick={() => setDeleting("idle")}
              >
                {t("keepMyAccount")}
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

function AssistantNameField({ id }: { id: AssistantId }) {
  const { t } = useLocale();
  const { settings, update } = useSettings();
  const names = settings.assistant.names;
  const stored = names?.[id] ?? "";
  const [value, setValue] = useState(stored);
  const [taken, setTaken] = useState(false);
  const role = t(ASSISTANT_ROLE_KEYS[id]);
  const commit = () => {
    const next = value.trim().slice(0, MAX_ASSISTANT_NAME_LENGTH);
    if (next && nameTaken(id, next, names)) return setTaken(true);
    setTaken(false);
    setValue(next);
    if (next === stored) return;
    const { [id]: _replaced, ...others } = names ?? {};
    const merged = next ? { ...others, [id]: next } : others;
    update({
      assistant: { ...settings.assistant, names: Object.keys(merged).length ? merged : undefined },
    });
  };
  return (
    <li className="settings-field assistant-name">
      <label>
        <span>{role}</span>
        <input
          value={value}
          maxLength={MAX_ASSISTANT_NAME_LENGTH}
          placeholder={role}
          aria-label={t("nameOfName", { name: role })}
          aria-invalid={taken}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
      </label>
      {taken && (
        <p className="settings-error assistant-name__error" role="alert">
          {t("thatNameIsAlreadyUsed")}
        </p>
      )}
    </li>
  );
}

function PersonalizationSection() {
  const { t, locale } = useLocale();
  const account = useAccount();
  const { settings, update } = useSettings();
  const travel = settings.travel;
  const setTravel = (next: Partial<UserSettings["travel"]>) =>
    update({ travel: { ...travel, ...next } });
  const [preferences, setPreferences] = useState<Draft>({
    ...blankDraft(),
    preferences: travel.preferences,
  });
  const [memories, setMemories] = useState<{ key: string; value: string }[]>([]);
  const [memoryState, setMemoryState] = useState<"loading" | "ready" | "failed">("loading");
  const [deletingMemory, setDeletingMemory] = useState<string>();
  const [memoryDeletionFailed, setMemoryDeletionFailed] = useState(false);
  const memoryGeneration = useRef(0);
  const accountId = account.status === "signed-in" ? account.userId : undefined;

  const loadMemories = useCallback(async () => {
    if (!accountId) return;
    const generation = memoryGeneration.current;
    setMemoryState("loading");
    try {
      const response = await fetch("/api/account/memory", { cache: "no-store" });
      if (!response.ok) throw new Error("memory-list-failed");
      const body = (await response.json()) as { memories?: { key: string; value: string }[] };
      if (generation !== memoryGeneration.current) return;
      setMemories(Array.isArray(body.memories) ? body.memories : []);
      setMemoryState("ready");
    } catch {
      if (generation === memoryGeneration.current) setMemoryState("failed");
    }
  }, [accountId]);

  useEffect(() => {
    const current = memoryGeneration;
    const generation = ++current.current;
    setDeletingMemory(undefined);
    setMemoryDeletionFailed(false);
    if (!accountId) {
      setMemories([]);
      setMemoryState("ready");
      return () => {
        if (current.current === generation) current.current++;
      };
    }
    void loadMemories();
    return () => {
      if (current.current === generation) current.current++;
    };
  }, [accountId, loadMemories]);

  async function deleteMemory(key: string) {
    if (!accountId) return;
    const generation = memoryGeneration.current;
    setDeletingMemory(key);
    setMemoryDeletionFailed(false);
    try {
      const response = await fetch("/api/account/memory", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error("memory-delete-failed");
      const body = (await response.json()) as { deleted?: boolean };
      if (!body.deleted) throw new Error("memory-delete-missing");
      if (generation === memoryGeneration.current)
        setMemories((current) => current.filter((item) => item.key !== key));
    } catch {
      if (generation === memoryGeneration.current) setMemoryDeletionFailed(true);
    } finally {
      if (generation === memoryGeneration.current) setDeletingMemory(undefined);
    }
  }

  return (
    <div className="settings-form">
      <section className="settings-block" aria-labelledby="settings-long-term-memory">
        <div className="settings-row-item__line">
          <div className="settings-row-item__text">
            <h3 id="settings-long-term-memory">{t("longTermMemory")}</h3>
            <p className="settings-hint">{t("preferencesRememberedFromChatAre")}</p>
          </div>
          <Switch
            label={t("useLongTermMemory")}
            checked={settings.assistant.memory}
            disabled={account.status !== "signed-in"}
            onChange={(memory) => update({ assistant: { ...settings.assistant, memory } })}
          />
        </div>
        {account.status !== "signed-in" && <p className="settings-hint">{t("signInToUseLong")}</p>}
        {memoryDeletionFailed && <p role="alert">{t("yourRememberedPreferenceCouldNot")}</p>}
        {account.status !== "signed-in" ? (
          <p>{t("nothingIsRememberedYet")}</p>
        ) : memoryState === "loading" ? (
          <p role="status">{t("loadingRememberedPreferences")}</p>
        ) : memoryState === "failed" ? (
          <div role="alert">
            <p>{t("couldNotLoadRememberedPreferences")}</p>
            <button type="button" className="settings-pill" onClick={() => void loadMemories()}>
              {t("retry")}
            </button>
          </div>
        ) : memories.length === 0 ? (
          <p>{t("nothingIsRememberedYet")}</p>
        ) : (
          <ul className="memory-list">
            {memories.map(({ key, value }) => {
              const label = t(MEMORY_CATEGORY_LABEL[key] ?? "otherPreferences");
              return (
                <li className="memory-row memory-row--remembered" key={key}>
                  <div className="memory-row__main">
                    <span className="memory-row__label">{label}</span>
                    <span className="memory-row__value">{memoryDisplay(value, locale)}</span>
                  </div>
                  <button
                    type="button"
                    className="settings-pill"
                    aria-label={t("deleteMemoryV0", { v0: label })}
                    disabled={deletingMemory === key}
                    onClick={() => void deleteMemory(key)}
                  >
                    {deletingMemory === key ? t("deleting") : t("delete")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="settings-block" aria-labelledby="settings-style">
        <h3 id="settings-style">{t("communicationStyle")}</h3>
        <p className="settings-hint">{t("chooseHowYouWouldLike")}</p>
        <select
          className="settings-select"
          aria-label={t("communicationStyle")}
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
      <section className="settings-block" aria-labelledby="settings-assistant-names">
        <h3 id="settings-assistant-names">{t("assistantNames")}</h3>
        <p className="settings-hint">{t("renameTheAssistantsLeaveA")}</p>
        <ul className="assistant-names">
          {ASSISTANT_ORDER.map((id) => (
            <AssistantNameField key={id} id={id} />
          ))}
        </ul>
      </section>
      <p className="settings-hint">{t("whatThePlannerKnowsAbout")}</p>
      <h3 className="settings-group">{t("identity")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🏡"
          label={t("homeBase")}
          value={travel.homeCity}
          question={t("whereDoYourTripsUsually")}
        >
          {(close) => (
            <TextEditor
              label={t("homeBase")}
              initial={travel.homeCity}
              onSave={(homeCity) => {
                setTravel({ homeCity });
                close();
              }}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("travelParty")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="👥"
          label={t("travellers")}
          value={
            travel.travellers
              ? `${travel.travellers} ${travel.travellers === 1 ? t("person") : t("people")}`
              : ""
          }
          question={t("howManyPeopleUsuallyTravel")}
        >
          {(close) => (
            <TextEditor
              label={t("travellers")}
              numeric
              initial={travel.travellers?.toString() ?? ""}
              validate={(value) =>
                value &&
                !(Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20)
                  ? { key: "from1To20" }
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
      <h3 className="settings-group">{t("travelStyle")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🐢"
          label={t("pace")}
          value={travel.pace ? t(PACE_LABEL[travel.pace]) : ""}
          question={t("howFullShouldADay")}
        >
          {() => (
            <Segmented
              label={t("pace")}
              options={[
                ["relaxed", t("relaxed")],
                ["balanced", t("balanced")],
                ["packed", t("packed")],
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
          label={t("interests")}
          value={travel.interests.map((item) => t(keyForText(item))).join("、")}
          question={t("whatDoYouLoveDoing")}
        >
          {() => (
            <ChipGroup
              label={t("interests")}
              options={INTERESTS}
              value={travel.interests}
              onChange={(interests) => setTravel({ interests })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("foodTitle")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="🥗"
          label={t("dietary")}
          value={travel.dietary.map((item) => t(keyForText(item))).join("、")}
          question={t("anyDietaryRestrictionsOrAllergies")}
        >
          {() => (
            <ChipGroup
              label={t("dietaryNeeds")}
              options={DIETARY}
              value={travel.dietary}
              onChange={(dietary) => setTravel({ dietary })}
            />
          )}
        </MemoryRow>
      </ul>
      <h3 className="settings-group">{t("budgetTitle")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="💰"
          label={t("tripBudget")}
          value={
            travel.budget ? t("audV0ForAWhole", { v0: travel.budget.toLocaleString("en-AU") }) : ""
          }
          question={t("whatDoYouUsuallySpend")}
        >
          {(close) => (
            <TextEditor
              label={t("budgetAudWholeTrip")}
              numeric
              initial={travel.budget?.toString() ?? ""}
              validate={(value) =>
                value && !(Number(value) > 0) ? { key: "enterAnAmountAbove0" } : undefined
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
      <h3 className="settings-group">{t("otherPreferences")}</h3>
      <ul className="memory-list">
        <MemoryRow
          icon="📝"
          label={t("standingPreferences")}
          value={travel.preferences.join("; ")}
          question={t("anythingElseEveryTripShould")}
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
                  {t("savePreferences")}
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
  const { locale, t } = useLocale();
  const languageLabel = locale === "zh" ? "简体中文" : "English";
  return (
    <div className="settings-form">
      <SettingRow label={t("language")} value={languageLabel}>
        {() => (
          <Segmented
            label={t("language")}
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
          : t("theInterfaceFollowsThisSetting")}
      </p>
      <SettingRow label={t("region")} value={`🇦🇺 ${t("australia")}`} />
      <h3 className="settings-group">{t("advanced")}</h3>
      <SettingRow label={t("displayCurrency")} value={settings.displayCurrency}>
        {() => (
          <Segmented
            label={t("displayCurrency")}
            options={SUPPORTED_CURRENCIES.map((code) => [code, code] as const)}
            value={settings.displayCurrency}
            onChange={(displayCurrency) => displayCurrency && update({ displayCurrency })}
          />
        )}
      </SettingRow>
      <CurrencyNotice currency={settings.displayCurrency} />
      <SettingRow label={t("units")} value={t("metricCKm")} />
      <SettingRow label={t("tripData")} value={t(DATA_LABEL[settings.dataMode])}>
        {() => (
          <>
            <Segmented
              label={t("defaultTripData")}
              options={[
                ["default", t("thisSiteSDefault")],
                ["live", t("livePrices")],
                ["mock", t("sampleData")],
              ]}
              value={settings.dataMode}
              onChange={(value) => {
                if (!value) return;
                update({ dataMode: value });
                if (value !== "default") onDataMode(value);
              }}
            />
            <small className="settings-hint">{t("livePricesSearchRealHotels")}</small>
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
  const { t } = useLocale();
  const account = useAccount();
  if (account.status !== "signed-in")
    return (
      <p className="settings-lead">
        {account.status === "local" ? t("accountsAreNotSetUpOnThis") : t("signInWithGoogleGithub")}
      </p>
    );
  return (
    <div className="settings-form">
      <p className="settings-hint">{t("accountsYouCanSignIn")}</p>
      {account.connected.length ? (
        account.connected.map((item) => (
          <SettingRow
            key={`${item.provider}-${item.email ?? ""}`}
            label={PROVIDER_LABEL[item.provider.replace(/^oauth_/, "")] ?? item.provider}
            value={item.email ?? t("connected")}
          />
        ))
      ) : (
        <p className="settings-empty">{t("noConnectedAccountsYouSign")}</p>
      )}
      <div className="settings-actions">
        <button
          type="button"
          className="settings-pill"
          onClick={() => onAccountModal(account.manage)}
        >
          {t("connectOrDisconnect")}
        </button>
      </div>
    </div>
  );
}

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
      <nav className="settings-nav" aria-label={t("settingsSections")}>
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
