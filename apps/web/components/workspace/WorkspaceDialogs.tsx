"use client";
import { flushSync } from "react-dom";
import { Dialog } from "../ui/Dialog";
import { SettingsDialog } from "../account/SettingsDialog";
import type { WorkspaceController } from "./useWorkspaceController";
import { useLocale } from "../account/LocaleProvider";

export function WorkspaceDialogs({ model }: { model: WorkspaceController }) {
  const { t, money, notice: localizeNotice } = useLocale();
  const {
    dialog,
    plan,
    previousTotal,
    error,
    retry,
    busy,
    closeDialog,
    run,
    settingsSection,
    dataMode,
  } = model;

  return (
    <>
      {dialog && (
        <Dialog title={t(dialog === "review" ? "Review plan" : "Settings")} onClose={closeDialog}>
          {dialog === "review" && plan && (
            <>
              <p>
                {plan.brief.destination} · {money(plan.estTotal)} {t("estimated /")}{" "}
                {money(plan.budgetTotal)} {t("budget")}
              </p>
              <p>
                {previousTotal === undefined
                  ? t("No previous plan to compare.")
                  : t("Change from the previous estimate: {v0}.", {
                      v0: money(plan.estTotal - previousTotal),
                    })}
              </p>
              <h3>{t("Conflicts")}</h3>
              {plan.conflicts?.length ? (
                <ul>
                  {plan.conflicts.map((c, i) => (
                    <li key={i}>
                      {c.reason}
                      <ul>
                        {c.constraints.map((v, j) => (
                          <li key={j}>{v}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("No detected schedule conflicts.")}</p>
              )}
              {error && (
                <div className="error-text" role="alert">
                  {localizeNotice(error)}
                  {retry && (
                    <button disabled={busy} onClick={() => void run(retry)}>
                      {t("Retry update")}
                    </button>
                  )}
                </div>
              )}
              {!plan.sections.length && (
                <p>{t("No plan yet. Update your trip preferences to start.")}</p>
              )}
            </>
          )}
          {dialog === "settings" && (
            <SettingsDialog
              initial={settingsSection}
              onDataMode={dataMode.choose}
              onAccountModal={(open) => {
                // Close the native dialog's top layer before Clerk mounts its DOM portal.
                flushSync(closeDialog);
                open();
              }}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
