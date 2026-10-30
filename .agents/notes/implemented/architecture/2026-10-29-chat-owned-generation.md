# Agent Note: Generation belongs to its initiating Chat

Status: implemented

## Problem

The visible session owned the request controller. Switching Chats aborted the request, discarded
progress and made the open page determine where a reply could be applied. Keeping that controller
alive alone would let a late Plan replace edits or another Chat's state.

This partly supersedes the navigation-abort behavior in
[the catalog decision](2026-09-24-workspace-catalog-trip-storage.md); that note still owns storage.

## Decision

`useWorkspace.ts` owns in-memory turns by conversation ID. Each turn holds its controller, task,
starting Plan, session state and received progress. Navigation flushes the visible session and
restores the selected Chat's own turn. Completion persists messages to the initiating Chat through
`useWorkspaceStorage.ts`, preserving the catalog's active Chat and Trip. No request is restarted
when a Chat is reopened.

A Trip writer map refuses another Chat's send before adding a message or starting a request.
Different Trips can run concurrently. Stop aborts the owned turn, releases the writer and shows a
stopped status; failure exposes the saved task for Retry without repeating the user message.
Deleting a Chat or Trip cancels its owned work. Workspace teardown cancels all remaining work.

Manual Plan edits remain enabled while generation runs. Completion treats a newer `editVersion` as
a manual change against the starting Plan. A changed Plan keeps its edits; the originating Chat
retains the reply with a keyed conflict notice. Derived presentation fields do not constitute a
manual edit. The optional message notice is readable by existing snapshots; Plan fields and
catalog/snapshot versions are unchanged.

## Alternatives considered

- Continue aborting on navigation: loses useful work and cannot satisfy background continuation.
- Keep one global controller: prevents independent Trips from running and ties results to the page.
- Apply every successful Plan: overwrites manual edits made while its request was pending.
- Durable jobs: outside this slice; a browser refresh or closure does not preserve execution.

## Consequences

The Workspace owns execution only while mounted. Completed messages and Plans use the existing
browser catalog and account synchronization. Failed and stopped turn controls remain in memory;
the saved conversation survives reload, but its execution does not resume. This does not introduce
server-atomic or cross-device request ownership.

`chat-generation.e2e.mjs` uses real Chromium, controlled HTTP NDJSON streams and finite request/state
waits. Its evidence records pending and completed recovery for Trips, Calendar, Settings, another
Chat and another Trip, plus Stop, failure/Retry, conflict, writer exclusion, deletion and teardown.
