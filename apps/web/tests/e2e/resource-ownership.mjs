import { closeSync, fstatSync, lstatSync, openSync, writeSync } from "node:fs";
import { resolve } from "node:path";

export const OWNERSHIP_FILE = "ownership.json";
export const OWNERSHIP_SCHEMA_VERSION = 1;

export function canonicalResources(webRoot, invocationId) {
  return [
    {
      kind: "next-build-directory",
      path: `apps/web/.next-e2e-local-${invocationId}`,
      absolutePath: resolve(webRoot, `.next-e2e-local-${invocationId}`),
      type: "directory",
    },
    {
      kind: "temporary-tsconfig",
      path: `apps/web/.tsconfig-e2e-local-${invocationId}.json`,
      absolutePath: resolve(webRoot, `.tsconfig-e2e-local-${invocationId}.json`),
      type: "file",
    },
  ];
}

function identityFromStats(stats, type) {
  return {
    device: String(stats.dev),
    inode: String(stats.ino),
    birthtimeMs: String(stats.birthtimeMs),
    type,
  };
}

export function captureIdentity(path, expectedType) {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) throw new Error(`Owned resource is a symlink: ${path}`);
  const matchesType = expectedType === "directory" ? stats.isDirectory() : stats.isFile();
  if (!matchesType) throw new Error(`Owned resource has an unexpected type: ${path}`);
  return identityFromStats(stats, expectedType);
}

export function identityFromDescriptor(descriptor, expectedType) {
  const stats = fstatSync(descriptor);
  const matchesType = expectedType === "directory" ? stats.isDirectory() : stats.isFile();
  if (!matchesType) throw new Error("Ownership record file has an unexpected type.");
  return identityFromStats(stats, expectedType);
}

export function sameIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.birthtimeMs === right.birthtimeMs &&
    left.type === right.type,
  );
}

export function createIdentityMatcher() {
  const devices = new Map();
  const reverseDevices = new Map();
  return (actual, expected) => {
    if (
      !actual ||
      !expected ||
      actual.inode !== expected.inode ||
      actual.birthtimeMs !== expected.birthtimeMs ||
      actual.type !== expected.type
    )
      return false;
    const mapped = devices.get(expected.device);
    const reverse = reverseDevices.get(actual.device);
    if (
      (mapped !== undefined && mapped !== actual.device) ||
      (reverse !== undefined && reverse !== expected.device)
    )
      return false;
    devices.set(expected.device, actual.device);
    reverseDevices.set(actual.device, expected.device);
    return true;
  };
}

export function createRunOwnershipRecord({
  invocationId,
  directoryIdentity,
  evidenceIdentity,
  summaryIdentity,
  resources,
  resourceIdentities,
  createdAt,
}) {
  return {
    schemaVersion: OWNERSHIP_SCHEMA_VERSION,
    recordType: "run",
    invocationId,
    createdAt,
    directoryIdentity,
    evidenceIdentity,
    summaryIdentity,
    resources: resources.map((resource) => ({
      kind: resource.kind,
      path: resource.path,
      state: resource.state,
      identity: resourceIdentities[resource.kind] ?? null,
    })),
  };
}

export function writeOwnershipRecord(directory, record) {
  const path = resolve(directory, OWNERSHIP_FILE);
  const descriptor = openSync(path, "wx", 0o600);
  try {
    record.ownershipIdentity = identityFromDescriptor(descriptor, "file");
    writeSync(descriptor, `${JSON.stringify(record, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }
}
