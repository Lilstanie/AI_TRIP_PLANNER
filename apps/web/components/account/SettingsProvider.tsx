"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SETTINGS_KEY, UserSettings, defaultSettings } from "@/lib/account/settings";
import { useAccount } from "./AccountProvider";

type SettingsState = {
  settings: UserSettings;
  /** Replace some settings; stamps a new `updatedAt`, saves here and, signed in, to the account. */
  update(next: Partial<Omit<UserSettings, "version" | "updatedAt">>): void;
  /** Where the settings live right now, for the dialog to say so. */
  syncState: "local" | "syncing" | "synced" | "failed";
};

const SettingsContext = createContext<SettingsState>({
  settings: defaultSettings(),
  update: () => {},
  syncState: "local",
});

export const useSettings = () => useContext(SettingsContext);

function readLocal(): UserSettings {
  try {
    const parsed = UserSettings.safeParse(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
    return parsed.success ? parsed.data : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

function writeLocal(settings: UserSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Blocked storage: the settings still apply for this visit.
  }
}

/** The chosen appearance on <html>; "system" leaves it to prefers-color-scheme. */
function applyAppearance(appearance: UserSettings["appearance"]) {
  const root = document.documentElement;
  if (appearance === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance;
}

function applyLanguage(language: UserSettings["language"]) {
  document.documentElement.lang = language;
}

const newer = (a: UserSettings, b: UserSettings) =>
  Date.parse(a.updatedAt) > Date.parse(b.updatedAt);

async function putSettings(settings: UserSettings): Promise<UserSettings | undefined> {
  const response = await fetch("/api/account/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) return undefined;
  const parsed = UserSettings.safeParse((await response.json()).settings);
  return parsed.success ? parsed.data : undefined;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [syncState, setSyncState] = useState<SettingsState["syncState"]>("local");
  const current = useRef(settings);
  current.current = settings;

  // Read after hydration so server and first client render match.
  useEffect(() => setSettings(readLocal()), []);
  useEffect(() => applyAppearance(settings.appearance), [settings.appearance]);
  useEffect(() => applyLanguage(settings.language), [settings.language]);

  const signedIn = account.status === "signed-in" ? account.userId : undefined;
  // On sign-in the newer copy wins: the account's, or this browser's if it changed since.
  useEffect(() => {
    if (!signedIn) {
      setSyncState("local");
      return;
    }
    let active = true;
    setSyncState("syncing");
    void (async () => {
      try {
        const response = await fetch("/api/account/settings");
        if (!response.ok) throw new Error(String(response.status));
        const parsed = UserSettings.safeParse((await response.json()).settings);
        const local = current.current;
        let result = local;
        if (parsed.success && !newer(local, parsed.data)) result = parsed.data;
        else result = (await putSettings(local)) ?? local;
        if (!active) return;
        writeLocal(result);
        setSettings(result);
        setSyncState("synced");
      } catch {
        if (active) setSyncState("failed");
      }
    })();
    return () => {
      active = false;
    };
  }, [signedIn]);

  const update = useCallback<SettingsState["update"]>(
    (next) => {
      const settingsNow: UserSettings = {
        ...current.current,
        ...next,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      current.current = settingsNow;
      setSettings(settingsNow);
      writeLocal(settingsNow);
      if (!signedIn) return;
      setSyncState("syncing");
      void putSettings(settingsNow)
        .then((saved) => {
          if (saved && newer(saved, current.current)) {
            current.current = saved;
            setSettings(saved);
            writeLocal(saved);
          }
          setSyncState(saved ? "synced" : "failed");
        })
        .catch(() => setSyncState("failed"));
    },
    [signedIn],
  );

  return (
    <SettingsContext.Provider value={{ settings, update, syncState }}>
      {children}
    </SettingsContext.Provider>
  );
}
