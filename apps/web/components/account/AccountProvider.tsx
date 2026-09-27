"use client";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { authEnabled } from "@/lib/auth/config";

/**
 * Who is using the workspace. `local` means accounts are not configured on this deployment and
 * everything stays in the browser, exactly as before accounts existed; the other states come from
 * Clerk. Components read this instead of Clerk's hooks, which throw without a ClerkProvider.
 */
export type Account =
  | { status: "local" }
  | { status: "loading" }
  | { status: "signed-out"; signIn(): void; signUp(): void }
  | {
      status: "signed-in";
      userId: string;
      name: string;
      firstName: string;
      lastName: string;
      email?: string;
      emailVerified: boolean;
      imageUrl?: string;
      /** Sign-in methods linked through Clerk: Google, GitHub, Apple. */
      connected: { provider: string; email?: string }[];
      /** Saves a new first and last name to the Clerk user. */
      rename(firstName: string, lastName: string): Promise<void>;
      signOut(): Promise<void>;
      manage(): void;
    };

const AccountContext = createContext<Account>({ status: "local" });

export const useAccount = () => useContext(AccountContext);

function ClerkAccount({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const account = useMemo<Account>(() => {
    if (!isLoaded) return { status: "loading" };
    if (!isSignedIn || !userId)
      return {
        status: "signed-out",
        signIn: () => clerk.openSignIn(),
        signUp: () => clerk.openSignUp(),
      };
    const email = user?.primaryEmailAddress?.emailAddress;
    return {
      status: "signed-in",
      userId,
      name: user?.fullName || user?.username || email || "Your account",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      ...(email ? { email } : {}),
      emailVerified: user?.primaryEmailAddress?.verification?.status === "verified",
      connected: (user?.externalAccounts ?? []).map((external) => ({
        provider: external.provider,
        ...(external.emailAddress ? { email: external.emailAddress } : {}),
      })),
      rename: async (firstName, lastName) => {
        await user?.update({ firstName, lastName });
      },
      ...(user?.imageUrl ? { imageUrl: user.imageUrl } : {}),
      signOut: () => clerk.signOut(),
      manage: () => clerk.openUserProfile(),
    };
  }, [isLoaded, isSignedIn, userId, user, clerk]);
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  return authEnabled ? (
    <ClerkAccount>{children}</ClerkAccount>
  ) : (
    <AccountContext.Provider value={{ status: "local" }}>{children}</AccountContext.Provider>
  );
}
