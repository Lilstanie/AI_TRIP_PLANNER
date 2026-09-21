# AGENTS.md — Documentation

`docs/` describes the system as it is now, for people using or developing it. Each fact has one home;
everywhere else links to it. `pnpm verify:docs` checks the Markdown links.

## Where each kind of content belongs

| Content                                                       | Home                                                                  | Not here                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| Standing orders every session needs                           | Root `AGENTS.md`, one to three lines each, linking the home           | Examples, procedures, restated detail |
| Runtime structure: packages, graph, agents, contracts         | [architecture.md](architecture.md)                                    | Decision rationale, per-file detail   |
| HTTP routes and request/response formats                      | [api.md](api.md)                                                      | Implementation notes                  |
| Setup, commands, environment variables, providers, CI summary | [development.md](development.md)                                      | Why a tool or setting was chosen      |
| Current UI behaviour and editing rules                        | [workspace-ui.md](workspace-ui.md)                                    | Phase history, acceptance transcripts |
| Visual and interaction design rules, design models            | [design/](design/ui-guidelines.md)                                    | Implementation plans                  |
| Product direction and status                                  | [roadmap.md](roadmap.md)                                              | Task checklists, PR plans             |
| Ownership, branches and reviews                               | [team-workflow.md](team-workflow.md)                                  | Rules already in `AGENTS.md`          |
| Why a decision was made and what it beat                      | [Agent Notes](../.agents/notes/README.md)                             | —                                     |
| Plans and proposals not yet built                             | `proposed/` Agent Notes or GitHub issues                              | `docs/`                               |
| Repeatable workflows for AI tools                             | [Skills](../.agents/skills/)                                          | Product or runtime facts              |
| What one session did; retired plans and audits                | [Session logs](../.agents/session-logs/README.md), `.agents/archive/` | `docs/`                               |

## Writing rules

- Write the current state in the present tense. History lives in commits, PRs, Agent Notes, session
  logs and `.agents/archive/`; do not narrate what changed or what used to be true.
- Update the owning page in the same pull request as the code it describes. A page that disagrees with
  the code is a bug.
- Link to a fact's home instead of copying it; copies drift.
- Do not put rationale in `docs/`: state the behaviour and link the Agent Note that explains why.
- Do not add dated plans, TODO checklists or audit reports here; when a page stops describing the
  current system, move it to `.agents/archive/` unchanged.
