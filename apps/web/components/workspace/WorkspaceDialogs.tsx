"use client";
import { flushSync } from "react-dom";
import { Dialog } from "../ui/Dialog";
import { SettingsDialog } from "../account/SettingsDialog";
import type { WorkspaceModel } from "./useWorkspace";
import { useLocale } from "../account/LocaleProvider";

export function WorkspaceDialogs({ model }: { model: WorkspaceModel }) {
  const { t, money, delta, notice: localizeNotice } = useLocale();
  const { plan, previousTotal, error, canRetry, busy, retry, dataMode } = model.session;
  const { dialog, closeDialog, settingsSection } = model.layout;

  return (
    <>
      {dialog && (
        <Dialog title={t(dialog === "review" ? "Review plan" : "Settings")} onClose={closeDialog}>
          {dialog === "review" && plan && (
            <>
              <p>
                {plan.brief.destination} · {money(plan.estTotal)} {t("estimated /")}{" "}
                {money(plan.budgetTotal, plan.brief.budgetSource)} {t("budget")}
              </p>
              <p>
                {previousTotal === undefined
                  ? t("No previous plan to compare.")
                  : t("Change from the previous estimate: {v0}.", {
                      v0: delta(plan.estTotal - previousTotal),
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
                  {canRetry && (
                    <button disabled={busy} onClick={retry}>
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
