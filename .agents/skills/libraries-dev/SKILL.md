---
name: libraries-dev
description: Review or integrate Libraries.dev UI effects in AI_TRIP_PLANNER when the user mentions libraries.dev, libraries reveal/review/apply, or requests a thinking orb, border beam, voice visualizer, bot avatar, gooey transition, liquid metal or image reveal. Follow the workspace design contract and real application state.
---

# Libraries.dev effects

Use this skill for concrete effect selection and integration in `apps/web`. Use
[better-ui](../better-ui/SKILL.md) for general visual polish and
[better-layout](../better-layout/SKILL.md) for content arrangement. Read only the reference for the
library being considered; do not guess component props from another library.

## Project fit

Read the [design contract](../../../docs/design/ui-guidelines.md), relevant component and current
`apps/web/package.json` before recommending a package. The contract, semantic tokens, fixed workspace
layout, glass layers and existing motion helpers remain the defaults. A long wait alone does not
justify adding an effect.

- Prefer a restrained status indicator with a text label over decoration. Keep existing useful
  loading feedback during short waits. Avoid stacking effects on one element or adjacent elements.
- Border glows, metal materials, gooey transitions and illustrated avatars can conflict with the
  workspace contract. Explain the conflict and offer a compatible existing treatment; a request to
  install this skill does not change the design rules.
- Voice effects require an actual voice workflow. Image effects require actual permitted image
  content; do not introduce generated or decorative imagery just to use a library.
- Bind effects to real loading, streaming, agent, microphone or image state. Do not infer agent
  activity from elapsed time or invent statuses. Preserve error, cancellation and completed states.
- Use theme values from tokens. Canvas/WebGL belong in client components and need usable static
  fallbacks. Check each reference's reduced-motion caveats: not every package handles them itself.

## Library references

These are pinned upstream reference snapshots, including generic examples and non-web ports.
Use the React web guidance here; check the official package documentation against the version being
installed for current props, peers and compatibility. Reference install examples must be adapted to
this pnpm workspace.

| Library       | Package / component             | Relevant request                      | Reference                                       |
| ------------- | ------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Border beam   | `border-beam` / `BorderBeam`    | Border highlight or submit activity   | [Border beam](references/01-border-beam.md)     |
| Thinking orbs | `thinking-orbs` / `ThinkingOrb` | Labelled AI waiting or activity state | [Thinking orbs](references/02-thinking-orbs.md) |
| Gooey         | `liquid-gooey` / `Liquid`       | Merging or morphing shapes            | [Gooey](references/03-liquid-gooey.md)          |
| Voice         | `voice-glow` / `VoiceBeam`      | Audio-reactive voice feedback         | [Voice](references/04-voice-glow.md)            |
| Bot avatars   | `bot-avatars` / `BotAvatar`     | Avatar driven by actual agent state   | [Bot avatars](references/05-bot-avatars.md)     |
| Liquid metal  | `metal-fx` / `MetalFx`          | Requested metal treatment             | [Liquid metal](references/06-metal-fx.md)       |
| Image         | `img-fx` / `ImageGeneration`    | Image loading and reveal              | [Image](references/07-img-fx.md)                |

## Commands

### libraries reveal

List the seven libraries with their package names and a one-line purpose. This command needs no
project scan or edits.

### libraries review

Read the stack and scan for waiting states, prompt inputs, agent indicators, voice input and image
loading. Read the matching references when evaluating a fit. Rank suggestions by user benefit and
show verified `file:line` locations, the state/variant and the reason. Mark contract conflicts and
areas with no useful fit. Give at most one recommendation per UI area; alternatives must be labelled.
This mode is read-only. Finish by identifying which suggestions can be applied with `libraries apply`.

### libraries apply

1. Select the requested library and inspect its reference and installed-version official docs.
   Prefer the simpler effect if multiple choices satisfy the request.
2. Confirm the treatment fits the design contract or that the user has explicitly authorized the
   specific design change. Do not treat generic polish requests as permission for a redesign.
3. Add only needed packages to the web workspace, for example:

   ```bash
   pnpm --filter @trip/web add thinking-orbs
   pnpm --filter @trip/web add img-fx three
   ```

   Show the selected command. If the user already requested the effect's installation or
   implementation, proceed within that scope; otherwise obtain authorization before adding it.
   Installing this skill alone does not authorize npm dependencies.

4. Place the component in the owning feature folder or `components/ui` for a shared primitive.
   Preserve semantics, labels, focus and keyboard behavior; use a client boundary where needed.
   Wire real state and handle reduced motion, hidden tabs and unsupported rendering.
5. Follow [better-accessibility](../better-accessibility/SKILL.md), then
   [ui-verification](../ui-verification/SKILL.md) for light/dark, phone/desktop and reduced-motion
   checks with a repeatable artifact. Use [pre-push-checks](../pre-push-checks/SKILL.md) to select
   build/type/lint evidence. Update affected docs and add a [session log](../session-log/SKILL.md).
6. Report the package, location, useful tuning option and validation actually performed.

## Source and updates

Adapted from the [official free skill](https://libraries.dev/skill), pinned to upstream commit
`f20116327f4e3b28d0fb70b04437dfd092bf88fe`. References are preserved from that snapshot; this entrypoint
adds project routing and constraints. See [LICENSE](LICENSE) and
[third-party notices](../THIRD_PARTY_NOTICES.md). Compare upstream updates before replacing local
instructions. Pro options require the user's Libraries Pro access; do not introduce login or paid
setup into an ordinary review or install.
