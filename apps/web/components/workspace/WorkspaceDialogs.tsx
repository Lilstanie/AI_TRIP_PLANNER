"use client";
import { Dialog } from "../ui/Dialog";
import { CURRENT_KEY, money, parseSnapshot } from "@/lib/workspace";
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
    storageError,
    saved,
    notice,
    setDialog,
    setStorageError,
    setStorageEnabled,
    setNotice,
    restore,
    save,
    loadSaved,
    run,
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
          {dialog === "saved" && (
            <>
              <p>Saved on this browser only. Restoring a copy replaces your current workspace.</p>
              <div className="actions">
                <button disabled={!plan || busy || !plan.sections.length} onClick={save}>
                  Save current trip
                </button>
                <button onClick={loadSaved}>Reload saved trips</button>
                <button
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem(CURRENT_KEY);
                      if (!raw) throw new Error();
                      restore(parseSnapshot(JSON.parse(raw)));
                    } catch {
                      setStorageError("No readable workspace is available to restore.");
                    }
                  }}
                >
                  Restore last workspace
                </button>
              </div>
              <p className="muted">
                Chats and trips in the sidebar are also saved automatically in this browser.
              </p>
              {storageError && (
                <p role="alert" className="error-text">
                  {storageError}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              {saved.length ? (
                saved.map((item) => (
                  <article className="checkpoint" key={item.id}>
                    <h3>{item.plan.brief.destination}</h3>
                    <p>
                      {item.plan.brief.dates.join(" to ")} · {money(item.plan.estTotal)}
                    </p>
                    <p>Saved {new Date(item.savedAt).toLocaleString()}</p>
                    <button onClick={() => restore(item)}>Restore trip</button>
                  </article>
                ))
              ) : (
                <p>No saved trips yet. Save your current trip to keep a copy.</p>
              )}
            </>
          )}
          {dialog === "language" && (
            <p>
              English is the current interface language. You can chat in your preferred language;
              interface translation is not available yet.
            </p>
          )}
          {dialog === "account" && (
            <p>
              This is a single-user local workspace. No sign-in is required. Saved trips stay in
              this browser and are not synced to other devices.
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
