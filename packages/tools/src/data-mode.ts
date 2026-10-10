import { AsyncLocalStorage } from "node:async_hooks";

export type DataMode = "mock" | "live";

const requestMode = new AsyncLocalStorage<DataMode>();

export function configuredDataMode(): DataMode {
  return process.env.USE_MOCK_TOOLS === "false" ? "live" : "mock";
}

export function dataMode(): DataMode {
  return requestMode.getStore() ?? configuredDataMode();
}

export function mockEnabled(): boolean {
  return dataMode() === "mock";
}

export function runWithDataMode<T>(mode: DataMode | undefined, fn: () => T): T {
  return mode ? requestMode.run(mode, fn) : fn();
}

export function parseDataMode(value: string | null | undefined): DataMode | undefined {
  return value === "mock" || value === "live" ? value : undefined;
}
