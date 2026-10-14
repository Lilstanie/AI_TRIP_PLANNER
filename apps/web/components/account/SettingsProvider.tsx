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

  update(next: Partial<Omit<UserSettings, "version" | "updatedAt">>): void;

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
    return;
  }
}

function applyAppearance(appearance: UserSettings["appearance"]) {
  const root = document.documentElement;
  if (appearance === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance;
}

type SettingsCheckpoint = { revision: number; contents: string };
const checkpointKey = (userId: string) => `trip.settings.sync.v2:${userId}`;
const pendingKey = (userId: string) => `trip.settings.pending.v1:${userId}`;
const lastUserKey = "trip.settings.last-user.v1";
function hasOtherAccountCheckpoint(userId: string) {
  const prefix = "trip.settings.sync.v2:";
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix) && key !== checkpointKey(userId)) return true;
  }
  return false;
}
function readCheckpoint(userId: string): SettingsCheckpoint | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(checkpointKey(userId)) ?? "null");
    return value &&
      Number.isSafeInteger(value.revision) &&
      value.revision >= 0 &&
      typeof value.contents === "string"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
function saveCheckpoint(userId: string, revision: number, settings: UserSettings) {
  localStorage.setItem(
    checkpointKey(userId),
    JSON.stringify({ revision, contents: JSON.stringify(settings) }),
  );
}
function readPending(userId: string): UserSettings | undefined {
  try {
    const parsed = UserSettings.safeParse(
      JSON.parse(localStorage.getItem(pendingKey(userId)) ?? "null"),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
function savePending(userId: string, settings: UserSettings) {
  localStorage.setItem(pendingKey(userId), JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [syncState, setSyncState] = useState<SettingsState["syncState"]>("local");
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => setSettings(readLocal()), []);
  useEffect(() => applyAppearance(settings.appearance), [settings.appearance]);

  const signedIn = account.status === "signed-in" ? account.userId : undefined;

  const queue = useRef(Promise.resolve());
  const identity = useRef(signedIn);
  identity.current = signedIn;
  useEffect(() => {
    if (!signedIn) {
      setSyncState("local");
      return;
    }
    const previousUser = localStorage.getItem(lastUserKey);
    if (previousUser && previousUser !== signedIn) {
      const previousCheckpoint = readCheckpoint(previousUser);
      if (previousCheckpoint && JSON.stringify(current.current) !== previousCheckpoint.contents)
        savePending(previousUser, current.current);
    }
    const pending = readPending(signedIn);
    if (pending) {
      current.current = pending;
      writeLocal(pending);
      if (JSON.stringify(settings) !== JSON.stringify(pending)) setSettings(pending);
    }
    let active = true;
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (!active || identity.current !== signedIn) return;
        setSyncState("syncing");
        try {
          const response = await fetch("/api/account/settings");
          if (!response.ok) throw new Error(String(response.status));
          const remote = await response.json();
          const parsed = UserSettings.safeParse(remote.settings);
          if (!Number.isSafeInteger(remote.revision) || remote.revision < 0)
            throw new Error("Invalid settings revision.");
          if (identity.current !== signedIn) return;
          const local = current.current;
          const base = readCheckpoint(signedIn);
          const clean = base
            ? JSON.stringify(local) === base.contents
            : JSON.stringify(local) === JSON.stringify(defaultSettings());
          if (!base && parsed.success) {
            saveCheckpoint(signedIn, remote.revision, parsed.data);
            localStorage.setItem(lastUserKey, signedIn);
            current.current = parsed.data;
            writeLocal(parsed.data);
            if (JSON.stringify(local) !== JSON.stringify(parsed.data)) setSettings(parsed.data);
            setSyncState("synced");
            return;
          }
          if (!base && !parsed.success && hasOtherAccountCheckpoint(signedIn)) {
            const defaults = defaultSettings();
            saveCheckpoint(signedIn, remote.revision, defaults);
            localStorage.setItem(lastUserKey, signedIn);
            current.current = defaults;
            writeLocal(defaults);
            if (JSON.stringify(local) !== JSON.stringify(defaults)) setSettings(defaults);
            setSyncState("synced");
            return;
          }
          if (parsed.success && (clean || JSON.stringify(local) === JSON.stringify(parsed.data))) {
            saveCheckpoint(signedIn, remote.revision, parsed.data);
            current.current = parsed.data;
            writeLocal(parsed.data);
            if (JSON.stringify(local) !== JSON.stringify(parsed.data)) setSettings(parsed.data);
            setSyncState("synced");
            return;
          }
          if (base?.contents === JSON.stringify(local) && remote.revision === base.revision) {
            localStorage.setItem(lastUserKey, signedIn);
            setSyncState("synced");
            return;
          }
          const saved = await fetch("/api/account/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: local, revision: base?.revision ?? 0 }),
          });
          if (!saved.ok) throw new Error(`Settings pending (${saved.status}).`);
          const ack = await saved.json();
          if (
            !Number.isSafeInteger(ack.revision) ||
            ack.revision < 1 ||
            !UserSettings.safeParse(ack.settings).success
          )
            throw new Error("Invalid settings acknowledgement.");
          if (identity.current !== signedIn) return;
          saveCheckpoint(signedIn, ack.revision, local);
          localStorage.setItem(lastUserKey, signedIn);
          localStorage.removeItem(pendingKey(signedIn));
          setSyncState(current.current === local ? "synced" : "syncing");
        } catch {
          if (identity.current === signedIn) setSyncState("failed");
        }
      });
    }, 1500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [signedIn, settings]);

  const update = useCallback<SettingsState["update"]>((next) => {
    const settingsNow: UserSettings = {
      ...current.current,
      ...next,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    current.current = settingsNow;
    setSettings(settingsNow);
    writeLocal(settingsNow);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, syncState }}>
      {children}
    </SettingsContext.Provider>
  );
}
