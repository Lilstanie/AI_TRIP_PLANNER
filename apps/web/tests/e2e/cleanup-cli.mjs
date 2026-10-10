import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OWNERSHIP_FILE,
  OWNERSHIP_SCHEMA_VERSION,
  canonicalResources,
  identityFromDescriptor,
  sameIdentity,
} from "./resource-ownership.mjs";

const WEB = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ROOT = resolve(WEB, "../..");
const OUTPUT = resolve(ROOT, "output/e2e/local-test-cli");
const RUN_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+-[a-z0-9]{6}$/;
const REPEAT_ID = /^repeat-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+-[a-z0-9]{6}$/;
const INVOCATION_ID = /^(?:repeat-)?\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+-[a-z0-9]{6}$/;
const RESOURCE_STATES = new Set(["retained", "removed", "not-created", "unverifiable"]);

function emit(result, json) {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    console.log(`Local E2E cleanup ${result.outcome}: ${result.invocationId ?? "(no invocation)"}`);
    for (const resource of result.resources) {
      console.log(
        `${resource.status}: ${resource.path}${resource.reason ? ` (${resource.reason})` : ""}`,
      );
    }
    if (result.diagnostic) console.log(`Details: ${result.diagnostic}`);
  }
}

function resultFor(outcome, details = {}) {
  return {
    command: "cleanup",
    outcome,
    invocationId: details.invocationId ?? null,
    removed: details.removed ?? [],
    resources: details.resources ?? [],
    evidenceRetained: true,
    ...(details.summaryFile ? { summaryFile: details.summaryFile } : {}),
    ...(details.diagnostic ? { diagnostic: details.diagnostic } : {}),
  };
}

function within(parent, target) {
  const path = relative(parent, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function matches(pattern, value) {
  if (typeof value !== "string") return false;
  const match = pattern.exec(value);
  return match?.[0] === value;
}

function pathIdentity(path, expectedType) {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) throw new Error("path is a symbolic link");
  const matchesType = expectedType === "directory" ? stats.isDirectory() : stats.isFile();
  if (!matchesType) throw new Error(`expected a regular ${expectedType}`);
  const real = realpathSync(path);
  if (real !== path) throw new Error("real path differs from its canonical path");
  return {
    device: String(stats.dev),
    inode: String(stats.ino),
    birthtimeMs: String(stats.birthtimeMs),
    type: expectedType,
  };
}

function readJsonFile(path, expectedIdentity, label) {
  let descriptor;
  let value;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const identity = identityFromDescriptor(descriptor, "file");
    if (!sameIdentity(identity, expectedIdentity)) throw new Error(`${label} was replaced`);
    value = JSON.parse(readFileSync(descriptor, "utf8"));
  } catch {
    throw new Error(`${label} is malformed`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function readMaybeJsonFile(path, label) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} is missing`);
    throw error;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) throw new Error(`${label} is not a regular file`);
  if (realpathSync(path) !== path) throw new Error(`${label} has a noncanonical real path`);
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const identity = identityFromDescriptor(descriptor, "file");
    const pathId = {
      device: String(stats.dev),
      inode: String(stats.ino),
      birthtimeMs: String(stats.birthtimeMs),
      type: "file",
    };
    if (!sameIdentity(identity, pathId)) throw new Error();
    const value = JSON.parse(readFileSync(descriptor, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return { value, identity };
  } catch {
    throw new Error(`${label} is malformed`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function verifySummary(summary, invocationId, summaryPath, evidencePath) {
  const expectedSummaryPath = relative(ROOT, summaryPath);
  const expectedEvidencePath = relative(ROOT, evidencePath);
  if (summary.schemaVersion !== OWNERSHIP_SCHEMA_VERSION || summary.recordType !== "run")
    throw new Error("summary record type or schema is unsupported");
  if (summary.invocationId !== invocationId)
    throw new Error("summary invocation ID does not match");
  if (summary.summaryFile !== expectedSummaryPath) throw new Error("summary path is not canonical");
  if (summary.evidenceDirectory !== expectedEvidencePath)
    throw new Error("summary evidence path is not canonical");
  if (
    !summary.completedAt ||
    !Array.isArray(summary.results) ||
    !Array.isArray(summary.ownedResources)
  )
    throw new Error("summary is incomplete");

  for (const result of summary.results) {
    if (result.evidenceDirectory === undefined) continue;
    const target = resolve(ROOT, result.evidenceDirectory);
    if (!within(evidencePath, target))
      throw new Error("result evidence path is outside its invocation");
  }
}

function verifyRepeatSummary(summary, invocationId, summaryPath, evidencePath) {
  if (summary.schemaVersion !== OWNERSHIP_SCHEMA_VERSION || summary.recordType !== "repeat")
    throw new Error("repeat summary record type or schema is unsupported");
  if (summary.invocationId !== invocationId) throw new Error("repeat invocation ID does not match");
  if (summary.summaryFile !== relative(ROOT, summaryPath))
    throw new Error("repeat summary path is not canonical");
  if (summary.evidenceDirectory !== relative(ROOT, evidencePath))
    throw new Error("repeat evidence path is not canonical");
  if (
    !summary.completedAt ||
    !Array.isArray(summary.attempts) ||
    !Number.isSafeInteger(summary.requestedRepeatCount) ||
    summary.attempts.some((attempt) => attempt.status === "running")
  )
    throw new Error("repeat summary is incomplete");
}

function verifyOwnership(owner, summary, invocationId, identities, expectedResources) {
  if (
    owner.schemaVersion !== OWNERSHIP_SCHEMA_VERSION ||
    owner.recordType !== "run" ||
    owner.invocationId !== invocationId ||
    owner.createdAt !== summary.startedAt
  )
    throw new Error("ownership record does not match this run");
  if (!sameIdentity(owner.directoryIdentity, identities.directory))
    throw new Error("invocation directory was replaced");
  if (!sameIdentity(owner.evidenceIdentity, identities.evidence))
    throw new Error("evidence directory was replaced");
  if (!sameIdentity(owner.summaryIdentity, identities.summary))
    throw new Error("summary file was replaced");
  if (!sameIdentity(owner.ownershipIdentity, identities.ownership))
    throw new Error("ownership record was replaced");
  if (!Array.isArray(owner.resources) || owner.resources.length !== expectedResources.length)
    throw new Error("ownership resource list is unsupported");
  if (summary.ownedResources.length !== expectedResources.length)
    throw new Error("summary resource list is unsupported");

  for (let index = 0; index < expectedResources.length; index += 1) {
    const expected = expectedResources[index];
    const owned = owner.resources[index];
    const summarized = summary.ownedResources[index];
    if (
      owned.kind !== expected.kind ||
      owned.path !== expected.path ||
      summarized.kind !== expected.kind ||
      summarized.path !== expected.path ||
      summarized.state !== owned.state ||
      !RESOURCE_STATES.has(owned.state)
    )
      throw new Error(`resource record ${index + 1} does not match its canonical path and state`);
    if (owned.identity !== null) {
      if (
        !owned.identity ||
        owned.identity.type !== expected.type ||
        typeof owned.identity.device !== "string" ||
        typeof owned.identity.inode !== "string" ||
        typeof owned.identity.birthtimeMs !== "string"
      )
        throw new Error(`resource identity for ${owned.kind} is malformed`);
    }
    if (owned.state === "retained" && !owned.identity)
      throw new Error(`retained resource ${owned.kind} has no filesystem identity`);
    if (owned.state === "removed" && !owned.identity)
      throw new Error(`removed resource ${owned.kind} has no filesystem identity`);
    if (owned.state === "not-created" && owned.identity)
      throw new Error(`uncreated resource ${owned.kind} has an unexpected identity`);
  }
}

function openVerifiedForRewrite(path, expectedIdentity) {
  const descriptor = openSync(path, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0));
  const actual = identityFromDescriptor(descriptor, "file");
  if (!sameIdentity(actual, expectedIdentity)) {
    closeSync(descriptor);
    throw new Error("record file changed before update");
  }
  ftruncateSync(descriptor, 0);
  return descriptor;
}

function writeVerifiedJson(path, identity, value) {
  const descriptor = openVerifiedForRewrite(path, identity);
  try {
    writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }
}

function inspectResource(resource, definition, webRoot) {
  const target = definition.absolutePath;
  const relativePath = relative(webRoot, target);
  if (!within(webRoot, target) || relativePath !== target.slice(webRoot.length + 1))
    return { status: "blocked", reason: "path is outside the canonical web directory" };
  let stats;
  try {
    stats = lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT") {
      if (resource.state === "retained")
        return { status: "blocked", reason: "retained resource is missing or stale" };
      if (resource.state === "unverifiable")
        return { status: "blocked", reason: "resource ownership was not established" };
      return { status: "already_absent" };
    }
    return { status: "blocked", reason: "resource could not be inspected" };
  }
  if (resource.state !== "retained")
    return { status: "blocked", reason: `resource is present while recorded ${resource.state}` };
  if (stats.isSymbolicLink()) return { status: "blocked", reason: "resource is a symbolic link" };
  const matchesType = definition.type === "directory" ? stats.isDirectory() : stats.isFile();
  if (!matchesType)
    return { status: "blocked", reason: `resource is not a regular ${definition.type}` };
  try {
    if (realpathSync(target) !== target)
      return { status: "blocked", reason: "resource resolves outside its canonical path" };
  } catch {
    return { status: "blocked", reason: "resource real path could not be verified" };
  }
  const current = {
    device: String(stats.dev),
    inode: String(stats.ino),
    birthtimeMs: String(stats.birthtimeMs),
    type: definition.type,
  };
  if (!sameIdentity(current, resource.identity))
    return { status: "blocked", reason: "resource filesystem identity changed" };
  return { status: "removable" };
}

function cleanupResource(resource, definition, webRoot) {
  const inspected = inspectResource(resource, definition, webRoot);
  if (inspected.status !== "removable") return inspected;
  const target = definition.absolutePath;
  try {
    const lastCheck = inspectResource(resource, definition, webRoot);
    if (lastCheck.status !== "removable") return lastCheck;
    if (definition.type === "directory") rmSync(target, { recursive: true, force: false });
    else unlinkSync(target);
    return { status: "removed" };
  } catch {
    return { status: "blocked", reason: "resource could not be removed safely" };
  }
}

function loadInvocation(invocationId) {
  if (!matches(RUN_ID, invocationId) && !matches(REPEAT_ID, invocationId))
    throw new Error("invocation ID is unsupported");
  if (realpathSync(ROOT) !== ROOT) throw new Error("repository root is not canonical");
  const outputStats = lstatSync(OUTPUT);
  if (outputStats.isSymbolicLink() || !outputStats.isDirectory())
    throw new Error("invocation output root is not a regular directory");
  if (realpathSync(OUTPUT) !== OUTPUT) throw new Error("invocation output root is not canonical");
  const directory = resolve(OUTPUT, invocationId);
  if (!within(OUTPUT, directory) || relative(OUTPUT, directory) !== invocationId)
    throw new Error("invocation path is not canonical");
  const directoryIdentity = pathIdentity(directory, "directory");
  const ownerPath = resolve(directory, OWNERSHIP_FILE);
  const ownerResult = readMaybeJsonFile(ownerPath, "ownership record");
  const owner = ownerResult.value;
  const expectedResources = canonicalResources(WEB, invocationId);
  const summaryPath = resolve(directory, "summary.json");
  const evidencePath = resolve(directory, "evidence");
  const ownerSummaryIdentity = owner.summaryIdentity;
  const summary = readJsonFile(summaryPath, ownerSummaryIdentity, "summary");
  const summaryIdentity = pathIdentity(summaryPath, "file");
  const evidenceIdentity = pathIdentity(evidencePath, "directory");
  const identities = {
    directory: directoryIdentity,
    evidence: evidenceIdentity,
    summary: summaryIdentity,
    ownership: ownerResult.identity,
  };
  if (matches(RUN_ID, invocationId)) {
    if (owner.recordType !== "run") throw new Error("run ownership record has the wrong type");
    verifySummary(summary, invocationId, summaryPath, evidencePath);
    verifyOwnership(owner, summary, invocationId, identities, expectedResources);
  } else {
    if (owner.recordType !== "repeat")
      throw new Error("repeat ownership record has the wrong type");
    verifyRepeatSummary(summary, invocationId, summaryPath, evidencePath);
    if (
      owner.schemaVersion !== OWNERSHIP_SCHEMA_VERSION ||
      owner.invocationId !== invocationId ||
      owner.createdAt !== summary.startedAt ||
      !sameIdentity(owner.directoryIdentity, identities.directory) ||
      !sameIdentity(owner.evidenceIdentity, identities.evidence) ||
      !sameIdentity(owner.summaryIdentity, identities.summary) ||
      !sameIdentity(owner.ownershipIdentity, identities.ownership) ||
      !Array.isArray(owner.children) ||
      owner.children.length !== summary.attempts.length
    )
      throw new Error("repeat ownership record does not match its summary");
    const children = [];
    const childIds = new Set();
    for (let index = 0; index < summary.attempts.length; index += 1) {
      const attempt = summary.attempts[index];
      const linked = owner.children[index];
      const childId = linked?.invocationId;
      if (!matches(RUN_ID, childId) || childIds.has(childId))
        throw new Error(`repeat attempt ${index + 1} has an invalid child invocation ID`);
      childIds.add(childId);
      const childSummaryPath = resolve(OUTPUT, childId, "summary.json");
      if (
        !attempt.summaryFile ||
        !linked ||
        linked.summaryFile !== attempt.summaryFile ||
        attempt.summaryFile !== relative(ROOT, childSummaryPath)
      )
        throw new Error(`repeat attempt ${index + 1} has no matching child ownership link`);
      const childResult = readMaybeJsonFile(childSummaryPath, "repeat child summary");
      if (
        childResult.value.invocationId !== childId ||
        childResult.value.recordType !== "run" ||
        attempt.evidenceDirectory !== childResult.value.evidenceDirectory ||
        attempt.status !== childResult.value.outcome ||
        linked.invocationId !== childId ||
        !sameIdentity(linked.summaryIdentity, childResult.identity)
      )
        throw new Error(`repeat attempt ${index + 1} points outside its verified child`);
      const childOwnershipPath = resolve(OUTPUT, childId, OWNERSHIP_FILE);
      const childOwnershipIdentity = pathIdentity(childOwnershipPath, "file");
      if (!sameIdentity(linked.ownershipIdentity, childOwnershipIdentity))
        throw new Error(`repeat attempt ${index + 1} ownership record was replaced`);
      const child = loadInvocation(childId);
      if (child.owner.recordType !== "run")
        throw new Error(`repeat attempt ${index + 1} is not an ordinary run`);
      children.push(child);
    }
    return {
      recordType: "repeat",
      directory,
      ownerPath,
      summaryPath,
      summary,
      owner,
      summaryIdentity,
      ownerIdentity: ownerResult.identity,
      children,
    };
  }
  return {
    recordType: "run",
    directory,
    ownerPath,
    summaryPath,
    summary,
    owner,
    summaryIdentity,
    ownerIdentity: ownerResult.identity,
    resources: expectedResources,
  };
}

function parseArgs(args) {
  const json = args.includes("--json");
  const values = args.filter((arg) => arg !== "--json");
  if (values.length !== 1 || !matches(INVOCATION_ID, values[0]))
    return { json, error: "cleanup requires one canonical invocation ID." };
  return { json, invocationId: values[0] };
}

function cleanupRunInvocation(invocation) {
  const cleanedResources = [];
  const removed = [];
  for (let index = 0; index < invocation.resources.length; index += 1) {
    const definition = invocation.resources[index];
    const resource = invocation.owner.resources[index];
    const action = cleanupResource(resource, definition, WEB);
    const status = action.status === "removable" ? "removed" : action.status;
    if (status === "removed") {
      resource.state = "removed";
      invocation.summary.ownedResources[index].state = "removed";
      removed.push(definition.path);
    }
    cleanedResources.push({
      kind: definition.kind,
      path: definition.path,
      status,
      ...(action.reason ? { reason: action.reason } : {}),
    });
  }
  const blocked = cleanedResources.some((resource) => resource.status === "blocked");
  invocation.summary.cleanup = {
    outcome: blocked ? "blocked" : removed.length ? "cleaned" : "already_clean",
    completedAt: new Date().toISOString(),
    resources: cleanedResources,
  };
  writeVerifiedJson(invocation.ownerPath, invocation.ownerIdentity, invocation.owner);
  writeVerifiedJson(invocation.summaryPath, invocation.summaryIdentity, invocation.summary);
  return { cleanedResources, removed, blocked };
}

export async function runCleanupCli(args) {
  const parsed = parseArgs(args);
  if (parsed.error) {
    emit(resultFor("invalid", { diagnostic: parsed.error }), parsed.json);
    return 2;
  }

  const invocationId = parsed.invocationId;
  let directory;
  try {
    if (realpathSync(ROOT) !== ROOT) throw new Error("repository root is not canonical");
    let rootStats;
    try {
      rootStats = lstatSync(OUTPUT);
    } catch (error) {
      if (error.code === "ENOENT") {
        emit(
          resultFor("not_found", {
            invocationId,
            diagnostic: "No invocation output directory exists yet.",
          }),
          parsed.json,
        );
        return 1;
      }
      throw error;
    }
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory())
      throw new Error("invocation output root is not a regular directory");
    if (realpathSync(OUTPUT) !== OUTPUT) throw new Error("invocation output root is not canonical");
    directory = resolve(OUTPUT, invocationId);
    if (!within(OUTPUT, directory) || relative(OUTPUT, directory) !== invocationId)
      throw new Error("invocation path is not canonical");
  } catch (error) {
    emit(resultFor("blocked", { invocationId, diagnostic: error.message }), parsed.json);
    return 1;
  }

  try {
    lstatSync(directory);
  } catch (error) {
    if (error.code === "ENOENT") {
      emit(
        resultFor("not_found", {
          invocationId,
          diagnostic: "No invocation directory exists for this ID.",
        }),
        parsed.json,
      );
      return 1;
    }
    emit(
      resultFor("blocked", {
        invocationId,
        diagnostic: "Invocation directory could not be inspected.",
      }),
      parsed.json,
    );
    return 1;
  }

  let invocation;
  try {
    invocation = loadInvocation(invocationId);
  } catch (error) {
    emit(resultFor("blocked", { invocationId, diagnostic: error.message }), parsed.json);
    return 1;
  }

  const runs = invocation.recordType === "repeat" ? invocation.children : [invocation];
  const childResults = runs.map((child) => ({
    invocationId: child.summary.invocationId,
    summaryFile: relative(ROOT, child.summaryPath),
    ...cleanupRunInvocation(child),
  }));
  const cleanedResources = childResults.flatMap((child) =>
    child.cleanedResources.map((resource) => ({ ...resource, invocationId: child.invocationId })),
  );
  const removed = childResults.flatMap((child) => child.removed);
  const blocked = childResults.some((child) => child.blocked);
  const outcome = blocked ? "blocked" : removed.length ? "cleaned" : "already_clean";
  if (invocation.recordType === "repeat") {
    invocation.summary.cleanup = {
      outcome,
      completedAt: new Date().toISOString(),
      children: childResults.map(({ invocationId, summaryFile, cleanedResources: resources }) => ({
        invocationId,
        summaryFile,
        resources,
      })),
    };
    writeVerifiedJson(invocation.summaryPath, invocation.summaryIdentity, invocation.summary);
  }

  const result = resultFor(outcome, {
    invocationId,
    removed,
    resources: cleanedResources,
    summaryFile: relative(ROOT, invocation.summaryPath),
    ...(blocked ? { diagnostic: "One or more resources could not be verified or removed." } : {}),
  });
  emit(result, parsed.json);
  return blocked ? 1 : 0;
}
