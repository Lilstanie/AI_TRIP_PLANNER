// Owner: A — data mode (mock fixtures vs real providers).
//
// The mode used to be read straight off `process.env.USE_MOCK_TOOLS` in eleven
// places, which made it a deploy-time setting: changing it meant redeploying.
// The workspace now offers a per-request toggle, so the mode has to travel with
// the request instead.
//
// It is deliberately NOT stored by mutating `process.env`. Vercel's Fluid
// Compute reuses one function instance across concurrent requests, so a
// per-request write to the environment would leak into whatever else is in
// flight — one visitor's "live" would silently flip another's run. AsyncLocal-
// Storage keeps the value scoped to a single request's async call tree.

import { AsyncLocalStorage } from "node:async_hooks";

export type DataMode = "mock" | "live";

const requestMode = new AsyncLocalStorage<DataMode>();

/** The environment default, used when a request states no preference. */
export function configuredDataMode(): DataMode {
  return process.env.USE_MOCK_TOOLS === "false" ? "live" : "mock";
}

/** The mode in force for the current request. */
export function dataMode(): DataMode {
  return requestMode.getStore() ?? configuredDataMode();
}

export function mockEnabled(): boolean {
  return dataMode() === "mock";
}

/** Runs `fn` with `mode` in force; `undefined` keeps the environment default. */
export function runWithDataMode<T>(mode: DataMode | undefined, fn: () => T): T {
  return mode ? requestMode.run(mode, fn) : fn();
}

/** Parses the wire value sent by the workspace toggle. */
export function parseDataMode(value: string | null | undefined): DataMode | undefined {
  return value === "mock" || value === "live" ? value : undefined;
}
