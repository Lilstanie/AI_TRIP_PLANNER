"use client";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authEnabled } from "@/lib/auth/config";

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
      username?: string;
      email?: string;
      emailVerified: boolean;
      imageUrl?: string;

      connected: { provider: string; email?: string }[];

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
  const router = useRouter();
  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);
  const account = useMemo<Account>(() => {
    if (!isLoaded) return { status: "loading" };
    if (!isSignedIn || !userId)
      return {
        status: "signed-out",
        signIn: () => router.push("/sign-in"),
        signUp: () => router.push("/sign-up"),
      };
    const email = user?.primaryEmailAddress?.emailAddress;
    return {
      status: "signed-in",
      userId,
      name: user?.fullName || user?.username || email || "Your account",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      ...(user?.username ? { username: user.username } : {}),
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
      signOut: () => clerk.signOut({ redirectUrl: "/sign-in" }),
      manage: () => clerk.openUserProfile(),
    };
  }, [isLoaded, isSignedIn, userId, user, clerk, router]);
  if (account.status === "signed-out" || account.status === "loading") {
    return (
      <main className="auth-redirect" role="status">
        Opening your workspace…
      </main>
    );
  }
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  return authEnabled ? (
    <ClerkAccount>{children}</ClerkAccount>
  ) : (
    <AccountContext.Provider value={{ status: "local" }}>{children}</AccountContext.Provider>
  );
}
