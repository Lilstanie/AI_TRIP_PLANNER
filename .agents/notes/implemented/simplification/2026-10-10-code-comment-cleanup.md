# Agent Note: Remove explanatory code comments

Status: implemented

## Problem

The user requested removal of code comments after the repository surface simplification. Comment
syntax also carries compiler/lint instructions, regression-check markers and third-party notices;
deleting those would change checks or remove attribution.

## Decision

Remove explanatory comments from maintained application/package source, tests, maintenance scripts,
Android configuration and the submission builders. Preserve executable/tool directives, shebangs,
SQL statement delimiters and third-party copyright/license notices. Strings, regular expressions,
template contents and Python docstrings remain code or data.

Frozen history, protected verification scripts and GitHub/team configuration, generated Next types,
lock metadata, Gradle wrapper scripts and rendered architecture diagrams are outside this cleanup.
No runtime contract, package boundary, test assertion or provider behavior changes; shared source
changes remove explanatory text only. This is a one-time cleanup, not a ban on future useful comments.

## Alternatives considered

- Delete every comment-shaped span: breaks type/lint expectations and selector guards, risks strings,
  and removes third-party notices.
- Move all removed prose into documentation: recreates the requested clutter without changing code.

## Consequences

Implementation rationale is less visible beside code; existing domain docs and decision notes remain
its maintained reference. Parser comparisons preserve TypeScript syntax-tree tokens and CSS structure;
Python AST equality protects its builder. Existing checks provide regression evidence without adding
another framework. Android compilation still requires its SDK; the cleanup does not establish native
or live-provider behavior.

## Sources

- [Earlier surface reduction](2026-10-10-repository-surface-reduction.md)
- [Development and test entry points](../../../../docs/development.md)
