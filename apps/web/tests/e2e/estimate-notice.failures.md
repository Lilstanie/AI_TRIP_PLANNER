# Estimate notice failure inventory

Written before the notice stopped reporting a zero change.

- A chat turn that kept the plan (a question, or a follow-up the offline planner cannot read) still
  puts "Estimate unchanged from the previous plan." with a Dismiss button above the chat.
- A replan that keeps the same total does the same.
- A replan that moves the total loses its notice, so the traveller no longer sees by how much.
- A timeline edit leaves a stale notice from the last chat replan.
- The notice wording is English only.

Evidence: `offline-follow-up.e2e.mjs` records the notice after a no-change turn and after a replan.
