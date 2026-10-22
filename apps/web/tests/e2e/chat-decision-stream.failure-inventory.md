# Chat decision stream failure inventory

Before changing production code, the retained API journey must distinguish these failures:

- A chat turn with a budget conflict streams no `decision` event, so a chat view has to parse the coordinator's prose.
- The decisions arrive out of order: `loop_stopped` before `conflicts_detected`, or a revision score before its revision started.
- A `conflicts_detected` event omits the target specialist or its saving.
- A `revision_scored` event omits the before and after scores or whether the revision was kept.
- A turn without conflicts does not stream `loop_stopped` with `converged` in round 1.
- A `decision` event fails the shared `AgentProgressEvent` schema, so a client that parses the stream rejects it.
- The existing `coordinator` events change or disappear.
- The Agent Lab trace changes because the chat path now publishes decisions.

The E2E uses mock data mode and no keys. The first run is expected to fail before implementation.
