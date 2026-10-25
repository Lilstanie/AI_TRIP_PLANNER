# Brief intake failure inventory

Written before implementation for architecture review item 1.

- Plan, offline partial/submitted, model replan and model end-of-turn can disagree on readiness.
- A model completes a partial brief without calling replan; it must still reach the same gate.
- Ambiguous `and` destinations bypass clarification through plan, extractor or model entry.
- Confirming the literal place name or choosing `&` must proceed; ordinary destinations remain unchanged.
- A missing/invalid brief, including impossible or reversed dates, must never invoke specialists.
- Past dates need explicit confirmation for the same date pair, independent of prompt wording/language.
- An unprompted, vague, stale or different-date confirmation must remain blocked.
- Legacy text-only prompts fail closed and get a new typed confirmation prompt.
- Destination coordinates apply only to a matching destination; UTC is the fallback.
- Today/future dates proceed and existing historical plans remain editable.
- Stated dates, inclusive duration, group size and dietary needs survive every patch source.
- Memory-off removes learned preferences; attachments and unchanged-plan replies retain behavior.
- Metadata must survive ChatTurn schema parsing and memory serialization.

Evidence: public runTripChat matrix writes JSON; HTTP planning-readiness journey writes NDJSON and checks.
