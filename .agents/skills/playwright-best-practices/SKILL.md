---
name: playwright-best-practices
description: Playwright reference guidance adapted for AI_TRIP_PLANNER. Use when writing or reviewing browser E2E scenarios, improving locators and waits, debugging flaky tests, or investigating network, mobile, accessibility, authentication and PWA behavior. Follow the project test runner and acceptance rules.
license: MIT
metadata:
  source: currents-dev/playwright-best-practices-skill
  source-commit: 283d5cbc5d11aac1abda058b16ad22c317d54dc0
  author: currents.dev
  version: "1.2"
---

# Playwright Best Practices

## Project scope

This is a project-local reference skill. Read [development](../../../docs/development.md#agent-workflows)
for ownership and [the integration decision](../../notes/implemented/process/2026-10-11-framework-reference-skills.md)
for provenance and update rules. Apply the relevant references on demand. Upstream examples describe
generic applications and must be checked against this project's installed dependency versions.

[Testing approach](../../../docs/development.md#testing-approach) owns test selection, and
[ui-verification](../ui-verification/SKILL.md) owns browser acceptance. Keep the project's E2E-first
policy, failure inventory and repeatable evidence requirements. The upstream test-type matrix is a
generic reference and does not replace that policy.

The current browser journeys use the Playwright library and the repository's CLI, rather than an
installed Playwright Test runner. Use [the local E2E CLI](../../../docs/local-test-cli.md) for supported
fixture journeys and the documented raw runner for other scenarios. Examples importing
`@playwright/test`, its fixtures or its assertions describe a possible future migration; they do not
make those APIs available here. Apply role and label locators, condition-based waits, isolated contexts and
network control through the existing harness where supported. A runner migration needs its own scope.

Use [pre-push-checks](../pre-push-checks/SKILL.md) to select validation. Preserve failed attempts and
missing prerequisites in evidence; a later pass does not erase an earlier failure. Avoid automatic
repeat runs unless critical behavior or an unresolved stability concern justifies them.

## Reference index

Choose only the references needed for the authorized task. Framework and test-runner examples
remain conditional on the project scope above.

### Core browser test techniques

| Topic                            | Reference                                                         |
| -------------------------------- | ----------------------------------------------------------------- |
| Test Annotations & Organization  | [annotations](references/core/annotations.md)                     |
| Assertions & Waiting             | [assertions-waiting](references/core/assertions-waiting.md)       |
| Playwright Configuration         | [configuration](references/core/configuration.md)                 |
| Fixtures & Hooks                 | [fixtures-hooks](references/core/fixtures-hooks.md)               |
| Global Setup & Teardown          | [global-setup](references/core/global-setup.md)                   |
| Locator Strategies               | [locators](references/core/locators.md)                           |
| Page Object Model (POM)          | [page-object-model](references/core/page-object-model.md)         |
| Projects & Dependencies          | [projects-dependencies](references/core/projects-dependencies.md) |
| Test Data Factories & Generators | [test-data](references/core/test-data.md)                         |
| Test Suite Structure             | [test-suite-structure](references/core/test-suite-structure.md)   |
| Test Tags                        | [test-tags](references/core/test-tags.md)                         |

### Debugging and failure investigation

| Topic                                       | Reference                                                |
| ------------------------------------------- | -------------------------------------------------------- |
| Browser Console & JavaScript Error Handling | [console-errors](references/debugging/console-errors.md) |
| Debugging & Troubleshooting                 | [debugging](references/debugging/debugging.md)           |
| Error & Edge Case Testing                   | [error-testing](references/debugging/error-testing.md)   |
| Debugging and Managing Flaky Tests          | [flaky-tests](references/debugging/flaky-tests.md)       |

### Testing patterns

| Topic                               | Reference                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Accessibility Testing               | [accessibility](references/testing-patterns/accessibility.md)               |
| API Testing                         | [api-testing](references/testing-patterns/api-testing.md)                   |
| Browser Extension Testing           | [browser-extensions](references/testing-patterns/browser-extensions.md)     |
| Canvas & WebGL Testing              | [canvas-webgl](references/testing-patterns/canvas-webgl.md)                 |
| Component Testing                   | [component-testing](references/testing-patterns/component-testing.md)       |
| Drag and Drop Testing               | [drag-drop](references/testing-patterns/drag-drop.md)                       |
| Electron Testing                    | [electron](references/testing-patterns/electron.md)                         |
| File Upload & Download Testing      | [file-operations](references/testing-patterns/file-operations.md)           |
| File Upload and Download Testing    | [file-upload-download](references/testing-patterns/file-upload-download.md) |
| Form Testing Patterns               | [forms-validation](references/testing-patterns/forms-validation.md)         |
| GraphQL Testing                     | [graphql-testing](references/testing-patterns/graphql-testing.md)           |
| Internationalization (i18n) Testing | [i18n](references/testing-patterns/i18n.md)                                 |
| Performance Testing & Web Vitals    | [performance-testing](references/testing-patterns/performance-testing.md)   |
| Security Testing Basics             | [security-testing](references/testing-patterns/security-testing.md)         |
| Visual Regression Testing           | [visual-regression](references/testing-patterns/visual-regression.md)       |

### Advanced scenarios

| Topic                                | Reference                                                           |
| ------------------------------------ | ------------------------------------------------------------------- |
| Complex Authentication Flow Patterns | [authentication-flows](references/advanced/authentication-flows.md) |
| Authentication Testing               | [authentication](references/advanced/authentication.md)             |
| Date, Time & Clock Mocking           | [clock-mocking](references/advanced/clock-mocking.md)               |
| Mobile & Responsive Testing          | [mobile-testing](references/advanced/mobile-testing.md)             |
| Multi-Tab, Window & Popup Testing    | [multi-context](references/advanced/multi-context.md)               |
| Multi-User & Collaboration Testing   | [multi-user](references/advanced/multi-user.md)                     |
| Advanced Network Interception        | [network-advanced](references/advanced/network-advanced.md)         |
| Third-Party Service Mocking          | [third-party](references/advanced/third-party.md)                   |

### Browser capabilities

| Topic                                         | Reference                                                     |
| --------------------------------------------- | ------------------------------------------------------------- |
| Browser APIs: Geolocation, Permissions & More | [browser-apis](references/browser-apis/browser-apis.md)       |
| iFrame Testing                                | [iframes](references/browser-apis/iframes.md)                 |
| Service Worker Testing                        | [service-workers](references/browser-apis/service-workers.md) |
| WebSocket & Real-Time Testing                 | [websockets](references/browser-apis/websockets.md)           |

### Test architecture references

| Topic                                       | Reference                                                         |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Organizing Reusable Test Code               | [pom-vs-fixtures](references/architecture/pom-vs-fixtures.md)     |
| Choosing Test Types: E2E, Component, or API | [test-architecture](references/architecture/test-architecture.md) |
| Mocking Strategy: Real vs Mock Services     | [when-to-mock](references/architecture/when-to-mock.md)           |

### Framework references

| Topic                           | Reference                                   |
| ------------------------------- | ------------------------------------------- |
| Angular Testing with Playwright | [angular](references/frameworks/angular.md) |
| Next.js Testing Patterns        | [nextjs](references/frameworks/nextjs.md)   |
| React Application Testing       | [react](references/frameworks/react.md)     |
| Vue and Nuxt Testing            | [vue](references/frameworks/vue.md)         |

### Infrastructure and reporting

| Topic                                   | Reference                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------- |
| CI and CD Integration                   | [ci-cd](references/infrastructure-ci-cd/ci-cd.md)                         |
| Container-Based Testing                 | [docker](references/infrastructure-ci-cd/docker.md)                       |
| GitHub Actions for Playwright           | [github-actions](references/infrastructure-ci-cd/github-actions.md)       |
| GitLab CI and CD Configuration          | [gitlab](references/infrastructure-ci-cd/gitlab.md)                       |
| CI: CircleCI, Azure DevOps, and Jenkins | [other-providers](references/infrastructure-ci-cd/other-providers.md)     |
| Sharding and Parallel Execution         | [parallel-sharding](references/infrastructure-ci-cd/parallel-sharding.md) |
| Performance & Parallelization           | [performance](references/infrastructure-ci-cd/performance.md)             |
| Test Reports & Artifacts                | [reporting](references/infrastructure-ci-cd/reporting.md)                 |
| Test Coverage                           | [test-coverage](references/infrastructure-ci-cd/test-coverage.md)         |

## Project validation loop

1. Select the existing journey and runner documented in the project, then run the relevant command.
2. Inspect its summary, logs, screenshots and available trace or API artifacts when it fails.
3. Fix the cause and rerun the affected scenario; report failures, skips and missing evidence honestly.
4. Use the documented repeat command only for a supported journey when repeatability is in question.
