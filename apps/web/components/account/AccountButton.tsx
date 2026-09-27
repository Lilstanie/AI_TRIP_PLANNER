"use client";
import { UserIcon } from "../ui/icons";
import { useAccount } from "./AccountProvider";
import type { SettingsSection } from "./SettingsDialog";

/**
 * The sidebar's account control. Local (accounts not configured) and signed in, it opens the
 * account section of Settings; signed out, it signs in. Signed in it shows the person's own
 * picture or initial, so they can tell which account the workspace is syncing to.
 */
export function AccountButton({
  collapsed,
  onSettings,
}: {
  collapsed: boolean;
  onSettings(section?: SettingsSection): void;
}) {
  const account = useAccount();
  if (account.status === "signed-in") {
    const first = account.name.split(" ")[0] ?? account.name;
    return (
      <button
        type="button"
        className="sidebar-icon-button account-button"
        aria-label={`Account: ${account.name}`}
        data-tooltip={collapsed ? account.name : undefined}
        onClick={() => onSettings("account")}
      >
        {account.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="account-button__avatar" src={account.imageUrl} alt="" width={20} height={20} />
        ) : (
          <span className="account-button__avatar account-button__initial" aria-hidden="true">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {!collapsed && <span className="account-button__name">{first}</span>}
      </button>
    );
  }
  const signedOut = account.status === "signed-out";
  const label = signedOut ? "Sign in" : account.status === "loading" ? "Account" : "Local";
  return (
    <button
      type="button"
      className="sidebar-icon-button"
      aria-label={signedOut ? "Sign in" : "Account"}
      aria-busy={account.status === "loading" || undefined}
      data-tooltip={collapsed ? label : undefined}
      onClick={() => (signedOut ? account.signIn() : onSettings("account"))}
    >
      <UserIcon />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
