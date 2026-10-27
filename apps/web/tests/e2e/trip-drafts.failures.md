# Trip draft failure inventory

The agreed seam is the real Trip workspace in a browser with deterministic fixture planning and
place responses. It covers visible state, navigation, retries and confirmation decisions; it does
not establish live-provider correctness or physical-device browser history behavior.

- A time, place-search, note or details field is lost when the Stop row or Trip view unmounts.
- Returning to a day with a draft leaves no usable route back to the exact Stop and field.
- A draft from another Trip appears after switching saved Trips or has its fields mixed into a
  same-id Stop.
- Close, Escape or Back discards a changed field without asking, on any viewport size.
- Continue editing loses the field value or focus; Discard applies the unfinished value.
- A failed time/place save closes the editor or drops values instead of allowing retry.
- A failed AddStop search or save drops the add form, or leaves the restored entry pointing at a blank AddStop form.
- Switching between Trip/map views, the 520px phone boundary, and the 521px tablet boundary loses a dirty AddStop/time field or routes its restore entry to another field.
- Switching to a different saved Trip exposes the first Trip's restore entry or fields; returning to the first Trip fails to restore its own field.
- A dirty draft is submitted against a newer Plan revision and replaces that revision's field;
  editing the stale field again also replaces its original base and hides the stale warning.
- Replanning with confirmed consent while a dirty field is stored changes the Plan, but restoring and saving the old draft overwrites the newer field value.
- A successful save leaves the saved field marked as unfinished, or clears an unrelated field.

Each implementation slice starts with one failing browser assertion at this seam. Artifacts belong
under `output/playwright/trip-drafts/<EVIDENCE_LABEL>/`.

Current browser evidence covers Trip isolation and note restore/discard at 1440px and 521px,
AddStop fields (including suggested times) across day/map navigation and 520px/521px/390px, and a
forced 503 followed by a successful retry at 1440px. A phone note modal survives a 390px to 521px
transition and remains restorable after returning to 390px. The phone Escape test waits for the
phone shell and its modal or Restore entry before deciding whether to restore the draft, then
checks modal focus before pressing Escape. The first modal-only wait still failed in the parent
run: it had read the old tablet textbox and skipped Restore. The failure screenshot showed the
phone Restore entry with no modal. The revised check records before/after DOM state and exercises
three same-page transitions; the parent integration log records its result. These changes concern
E2E synchronization; no production change was needed. A concurrent workspace tab publishes a
newer Plan revision; saving the old time draft is refused before the preview-edit request, retains
the draft value, and leaves the newer revision intact. A same-page confirmed chat replan returns the
same Stop ID at a changed time; restoring the retained draft shows the stale notice, explicit rebase
keeps the user's time, and retry submits against the new 10:15 Plan and returns the requested 08:30
Plan through the UI. The note modal's scrim prevents using the obscured phone tab bar while it is
open; the tested navigation uses the responsive width transition and restore entry instead.
