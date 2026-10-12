---
name: vercel-react-best-practices
description: React and Next.js performance guidance adapted from Vercel for AI_TRIP_PLANNER. Use when writing, reviewing or refactoring React components, Next.js data fetching, bundle loading or rendering performance.
license: MIT
metadata:
  source: vercel-labs/agent-skills
  source-commit: 063bee94c3f4df8453406c830b0a7df0f2860278
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

## Project scope

This is a project-local reference skill. Read [development](../../../docs/development.md#agent-workflows)
for ownership and [the integration decision](../../notes/implemented/process/2026-10-11-framework-reference-skills.md)
for provenance and update rules. Apply the relevant references on demand. Upstream examples describe
generic applications and must be checked against this project's installed dependency versions.

Preserve the package boundaries in [architecture](../../../docs/architecture.md) and the
[workspace design contract](../../../docs/design/ui-guidelines.md). Select an optimization for an
observed problem; an example using SWR, a cache, a compiler feature or a newer React API does not
authorize adding dependencies, changing freshness or adopting unsupported APIs. Follow
[pre-push-checks](../pre-push-checks/SKILL.md) and [ui-verification](../ui-verification/SKILL.md)
for the change's acceptance checks.

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 70 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:

- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category                  | Impact      | Prefix       |
| -------- | ------------------------- | ----------- | ------------ |
| 1        | Eliminating Waterfalls    | CRITICAL    | `async-`     |
| 2        | Bundle Size Optimization  | CRITICAL    | `bundle-`    |
| 3        | Server-Side Performance   | HIGH        | `server-`    |
| 4        | Client-Side Data Fetching | MEDIUM-HIGH | `client-`    |
| 5        | Re-render Optimization    | MEDIUM      | `rerender-`  |
| 6        | Rendering Performance     | MEDIUM      | `rendering-` |
| 7        | JavaScript Performance    | LOW-MEDIUM  | `js-`        |
| 8        | Advanced Patterns         | LOW         | `advanced-`  |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- [async-cheap-condition-before-await](references/async-cheap-condition-before-await.md) - Check cheap sync conditions before awaiting flags or remote values
- [async-defer-await](references/async-defer-await.md) - Move await into branches where actually used
- [async-parallel](references/async-parallel.md) - Use Promise.all() for independent operations
- [async-dependencies](references/async-dependencies.md) - Use better-all for partial dependencies
- [async-api-routes](references/async-api-routes.md) - Start promises early, await late in API routes
- [async-suspense-boundaries](references/async-suspense-boundaries.md) - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- [bundle-barrel-imports](references/bundle-barrel-imports.md) - Import directly, avoid barrel files
- [bundle-analyzable-paths](references/bundle-analyzable-paths.md) - Prefer statically analyzable import and file-system paths to avoid broad bundles and traces
- [bundle-dynamic-imports](references/bundle-dynamic-imports.md) - Use next/dynamic for heavy components
- [bundle-defer-third-party](references/bundle-defer-third-party.md) - Load analytics/logging after hydration
- [bundle-conditional](references/bundle-conditional.md) - Load modules only when feature is activated
- [bundle-preload](references/bundle-preload.md) - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- [server-auth-actions](references/server-auth-actions.md) - Authenticate server actions like API routes
- [server-cache-react](references/server-cache-react.md) - Use React.cache() for per-request deduplication
- [server-cache-lru](references/server-cache-lru.md) - Use LRU cache for cross-request caching
- [server-dedup-props](references/server-dedup-props.md) - Avoid duplicate serialization in RSC props
- [server-hoist-static-io](references/server-hoist-static-io.md) - Hoist static I/O (fonts, logos) to module level
- [server-no-shared-module-state](references/server-no-shared-module-state.md) - Avoid module-level mutable request state in RSC/SSR
- [server-serialization](references/server-serialization.md) - Minimize data passed to client components
- [server-parallel-fetching](references/server-parallel-fetching.md) - Restructure components to parallelize fetches
- [server-parallel-nested-fetching](references/server-parallel-nested-fetching.md) - Chain nested fetches per item in Promise.all
- [server-after-nonblocking](references/server-after-nonblocking.md) - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- [client-swr-dedup](references/client-swr-dedup.md) - Use SWR for automatic request deduplication
- [client-event-listeners](references/client-event-listeners.md) - Deduplicate global event listeners
- [client-passive-event-listeners](references/client-passive-event-listeners.md) - Use passive listeners for scroll
- [client-localstorage-schema](references/client-localstorage-schema.md) - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- [rerender-defer-reads](references/rerender-defer-reads.md) - Don't subscribe to state only used in callbacks
- [rerender-memo](references/rerender-memo.md) - Extract expensive work into memoized components
- [rerender-memo-with-default-value](references/rerender-memo-with-default-value.md) - Hoist default non-primitive props
- [rerender-dependencies](references/rerender-dependencies.md) - Use primitive dependencies in effects
- [rerender-derived-state](references/rerender-derived-state.md) - Subscribe to derived booleans, not raw values
- [rerender-derived-state-no-effect](references/rerender-derived-state-no-effect.md) - Derive state during render, not effects
- [rerender-functional-setstate](references/rerender-functional-setstate.md) - Use functional setState for stable callbacks
- [rerender-lazy-state-init](references/rerender-lazy-state-init.md) - Pass function to useState for expensive values
- [rerender-simple-expression-in-memo](references/rerender-simple-expression-in-memo.md) - Avoid memo for simple primitives
- [rerender-split-combined-hooks](references/rerender-split-combined-hooks.md) - Split hooks with independent dependencies
- [rerender-move-effect-to-event](references/rerender-move-effect-to-event.md) - Put interaction logic in event handlers
- [rerender-transitions](references/rerender-transitions.md) - Use startTransition for non-urgent updates
- [rerender-use-deferred-value](references/rerender-use-deferred-value.md) - Defer expensive renders to keep input responsive
- [rerender-use-ref-transient-values](references/rerender-use-ref-transient-values.md) - Use refs for transient frequent values
- [rerender-no-inline-components](references/rerender-no-inline-components.md) - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- [rendering-animate-svg-wrapper](references/rendering-animate-svg-wrapper.md) - Animate div wrapper, not SVG element
- [rendering-content-visibility](references/rendering-content-visibility.md) - Use content-visibility for long lists
- [rendering-hoist-jsx](references/rendering-hoist-jsx.md) - Extract static JSX outside components
- [rendering-svg-precision](references/rendering-svg-precision.md) - Reduce SVG coordinate precision
- [rendering-hydration-no-flicker](references/rendering-hydration-no-flicker.md) - Use inline script for client-only data
- [rendering-hydration-suppress-warning](references/rendering-hydration-suppress-warning.md) - Suppress expected mismatches
- [rendering-activity](references/rendering-activity.md) - Use Activity component for show/hide
- [rendering-conditional-render](references/rendering-conditional-render.md) - Use ternary, not && for conditionals
- [rendering-usetransition-loading](references/rendering-usetransition-loading.md) - Prefer useTransition for loading state
- [rendering-resource-hints](references/rendering-resource-hints.md) - Use React DOM resource hints for preloading
- [rendering-script-defer-async](references/rendering-script-defer-async.md) - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- [js-batch-dom-css](references/js-batch-dom-css.md) - Group CSS changes via classes or cssText
- [js-index-maps](references/js-index-maps.md) - Build Map for repeated lookups
- [js-cache-property-access](references/js-cache-property-access.md) - Cache object properties in loops
- [js-cache-function-results](references/js-cache-function-results.md) - Cache function results in module-level Map
- [js-cache-storage](references/js-cache-storage.md) - Cache localStorage/sessionStorage reads
- [js-combine-iterations](references/js-combine-iterations.md) - Combine multiple filter/map into one loop
- [js-length-check-first](references/js-length-check-first.md) - Check array length before expensive comparison
- [js-early-exit](references/js-early-exit.md) - Return early from functions
- [js-hoist-regexp](references/js-hoist-regexp.md) - Hoist RegExp creation outside loops
- [js-min-max-loop](references/js-min-max-loop.md) - Use loop for min/max instead of sort
- [js-set-map-lookups](references/js-set-map-lookups.md) - Use Set/Map for O(1) lookups
- [js-tosorted-immutable](references/js-tosorted-immutable.md) - Use toSorted() for immutability
- [js-flatmap-filter](references/js-flatmap-filter.md) - Use flatMap to map and filter in one pass
- [js-request-idle-callback](references/js-request-idle-callback.md) - Defer non-critical work to browser idle time

### 8. Advanced Patterns (LOW)

- [advanced-effect-event-deps](references/advanced-effect-event-deps.md) - Don't put `useEffectEvent` results in effect deps
- [advanced-event-handler-refs](references/advanced-event-handler-refs.md) - Store event handlers in refs
- [advanced-init-once](references/advanced-init-once.md) - Initialize app once per app load
- [advanced-use-latest](references/advanced-use-latest.md) - useLatest for stable callback refs

## How to Use

Read individual rule files for detailed explanations and code examples:

```
references/async-parallel.md
references/bundle-barrel-imports.md
```

Each rule file contains:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references
