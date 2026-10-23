# Decided-by badge settles once: failure inventory

Written before the code (#600). While a plan streams, the Coordinator card says "Decided by code"
until the model's reasoning arrives, then switches to "Decided by AI" with the same text. Joey chose:
show no badge until the provenance is final. Each line is a way the fix could fail.

- A team message shows one badge while streaming and a different one afterwards.
- A message whose reasoning arrives late still shows "Decided by code" first.
- A message with no reasoning never gets a badge once the turn ends.
- A finished turn, reopened from history, has messages without a badge.
- The Chinese interface still flips between 程序决定 and AI 决定.
- A handoff message, whose provenance comes with the event, loses its badge while streaming.
