# Prose examples

Use these examples to preserve facts, not as fixed templates.

## Preserve units and scope

**Too short:** “Normalizes prices.”

**Useful:** “Converts provider fares to AUD whole-party totals; provider-native amounts remain
labelled evidence outside stored totals.”

Currency, party size and evidence scope are independent facts. Keep them when the owning adapter
actually promises them; do not use this sentence to invent a conversion it does not perform.

## Preserve the branch that produced the data

**Too short:** “Shows live search results.”

**Useful:** “Shows the source kind from the branch that returned the result, including fallback and
unavailable outcomes.”

A live configuration does not prove a particular request succeeded. Shortening must not remove the
distinction a traveller needs to judge the result.

## Preserve asynchronous ownership

**Too short:** “Cancels old requests.”

**Useful:** “Switching trips aborts the previous request and ignores late responses so they cannot
overwrite the selected trip.”

Requesting cancellation and protecting newer state are separate obligations. Keep both if the
implementation provides them; do not claim cancellation has completed merely because abort was sent.

## Keep observable verification

**Too short:** “Check the provider.”

**Useful:** “Exercise the provider through the user flow with stubbed responses, verify the displayed
price and source badge, and retain the run artifact.”

Keep the entry path, observed outcome and repeatable evidence. Avoid a walkthrough of fixture code.

## A link complements the local guarantee

**Too short:** “See the storage note.”

**Useful:** “The loader rejects unknown snapshot versions without overwriting them. See the storage
note for migration rationale.”

The failure guarantee belongs near the loader's consumer; the algorithm and history have one owner.

## Do not trim an intentional qualification

**Current:** “Use the current provider documentation to verify coverage and quotas; a catalog entry
is discovery evidence, not a production guarantee.”

**Worse:** “Use the API catalog.”

Keep the current distinction. Fewer words would invite a different, unsupported action.

## Remove branch narration, restore missing behavior

Delete “first check whether it is missing, then return, otherwise continue” when the adjacent code
already expresses that flow. If an early return protects user input from a late response, explain
that guarantee instead. A prose pass may add the missing sentence rather than shorten the file.
