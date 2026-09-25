# Agent Note: Project change entry map

Status: implemented
Owner: AI assistant

## Problem

The repository's runtime, package, UI and workflow guidance is already split across focused docs,
package READMEs and skills. A contributor starting from the architecture page still has to search for
the entry point that owns a particular change.

## Decision

`docs/architecture.md` has a compact change-entry table mapping common change areas to their first
implementation file and the downstream boundaries to inspect. It links to the owning docs and skills
instead of duplicating their procedures. Cross-boundary changes point to the end-to-end feature wiring
skill.

## Alternatives considered

**Add the map to root `AGENTS.md`.** Not chosen because that file is a short session entry point and
project instructions protect it from edits unless explicitly requested.

**Expand package documentation with a repository-wide index.** Not chosen because the architecture
page already introduces the runtime and is the natural starting point for locating its owners.

## Consequences

The map adds a small navigation table to the architecture page and must be updated when its named
entry points or ownership boundaries move. Package READMEs, docs and skills remain the source of truth
for detailed behavior and procedures.

## Sources

- [X article: 运行了 10 年的核心复杂业务系统，CLAUDE.md 里写了什么？](https://x.com/uudonX/status/2097591420567867841)
- [Project architecture](../../../../docs/architecture.md)
