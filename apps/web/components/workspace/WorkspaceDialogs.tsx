"use client";
import { Dialog } from "../ui/Dialog";
import { SettingsDialog } from "../account/SettingsDialog";
import { money } from "@/lib/workspace";
import type { WorkspaceController } from "./useWorkspaceController";

export function WorkspaceDialogs({ model }: { model: WorkspaceController }) {
  const {
    dialog,
    dialogTitle,
    plan,
    previousTotal,
    error,
    retry,
    busy,
    setDialog,
    run,
    settingsSection,
    dataMode,
  } = model;

  return (
    <>
      {dialog && (
        <Dialog title={dialogTitle} onClose={() => setDialog(undefined)}>
          {dialog === "review" && plan && (
            <>
              <p>
                {plan.brief.destination} · {money(plan.estTotal)} estimated /{" "}
                {money(plan.budgetTotal)} budget
              </p>
              <p>
                {previousTotal === undefined
                  ? "No previous plan to compare."
                  : `Change from the previous estimate: ${money(plan.estTotal - previousTotal)}.`}
              </p>
              <h3>Conflicts</h3>
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
                <p>No detected schedule conflicts.</p>
              )}
              {error && (
                <div className="error-text" role="alert">
                  {error}
                  {retry && (
                    <button disabled={busy} onClick={() => void run(retry)}>
                      Retry update
                    </button>
                  )}
                </div>
              )}
              {!plan.sections.length && <p>No plan yet. Update your trip preferences to start.</p>}
            </>
          )}
          {dialog === "settings" && (
            <SettingsDialog initial={settingsSection} onDataMode={dataMode.choose} />
          )}
        </Dialog>
      )}
    </>
  );
}
