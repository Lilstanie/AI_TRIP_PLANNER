# Project simplification patterns

These decisions calibrate a survey. Read current code and later notes before applying them; an old
removal does not establish that a similar feature is still unused.

## Require a complete effect path

The [decision-apparatus removal](../../../notes/implemented/simplification/2026-09-22-remove-hitl-decisions.md)
removed checkpoints with no downstream decision handling. Its question removal was later partly
superseded by [ask-user questions](../../../notes/implemented/feature/2026-09-23-ask-user-question.md),
whose answers feed the next turn. The useful distinction is whether the user's action changes a
working flow, not whether the feature resembles something previously removed.

## Remove a duplicate owner, preserve migration obligations

The [workspace catalog decision](../../../notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)
replaces a separate Save trip snapshot flow with one catalog. It still reads the active legacy
workspace snapshot as migration input when no catalog exists. Search persisted keys and load paths
before declaring the old representation redundant; do not erase user data because a button is gone.

## Consolidate representation at the correct point

The [AUD decision](../../../notes/implemented/architecture/2026-09-20-aud-base-currency.md) gives stored
amounts one currency, while provider-native fare evidence keeps its currency outside totals. A
single accounting representation reduces downstream branches without pretending original evidence
uses the same units.

## Keep a wrapper's complete interface

The [feature-wiring decision](../../../notes/implemented/process/2026-09-24-end-to-end-feature-wiring.md)
records repeated loss of methods and data across wrappers. Preserving an original typed port and
overriding decorated behavior removes a parallel member inventory. Verify the actual consumer and
exception paths, not only the wrapper's type declaration.
