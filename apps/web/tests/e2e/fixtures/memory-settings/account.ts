import { useSyncExternalStore } from "react";

type FixtureAccountState = "signed-in" | "local";
let state: FixtureAccountState = "signed-in";
const listeners = new Set<() => void>();

export function setFixtureAccount(next: FixtureAccountState) {
  state = next;
  for (const listener of listeners) listener();
}

export function useAccount() {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => "signed-in",
  );
  if (status === "local") return { status } as const;
  return {
    status,
    userId: "memory-settings-user",
    name: "Memory Settings User",
    firstName: "Memory",
    lastName: "Settings",
    email: "memory@example.test",
    emailVerified: true,
    connected: [],
    rename: async () => {},
    signOut: async () => setFixtureAccount("local"),
    manage: () => {},
  } as const;
}
