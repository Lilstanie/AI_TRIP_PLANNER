# Agent Note: Isolate local fixture E2E runs behind the existing CLI

Status: implemented

## Problem

The raw E2E runner inherits credentials and `BASE_URL`, so fixture assertions alone do not give a
reproducible local boundary or invocation-specific evidence.

## Decision

Keep raw named-script calls on the legacy runner and dispatch `e2e run` to a separate local CLI module.
The first supported journey is the registered Agent Lab single-agent fixture. Build and server children
receive a small environment allowlist, known integration credentials are blanked, mock tools are forced,
and Agent Lab live runs are disabled. Each invocation owns a unique build directory, server process group,
summary, logs and browser evidence. A unique temporary TypeScript config prevents Next from editing the
shared config as it discovers the owned build directory.

## Alternatives considered

- Reuse the raw runner: rejected because it honors inherited `BASE_URL` and passes all credentials to
  build, server and scripts.
- Copy the entire application to a temporary project root: rejected for this slice because the known
  credential names can be blocked without editing the user's dotenv files.

## Consequences

- The CLI currently supports only `agent-lab-single-agent`; other selections return `unsupported`.
- Credential names added by future integrations must be added to the deny list. This is not a network
  egress firewall.
- The legacy raw invocation retains its existing environment and server-reuse behavior.
- English and Chinese usage guidance lives in [local-test-cli.md](../../../../docs/local-test-cli.md)
  and [local-test-cli.zh.md](../../../../docs/local-test-cli.zh.md).
