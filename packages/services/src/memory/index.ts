// Owner: E — PreferenceMemoryService
// TODO(E): replace the in-memory Maps with a real store (SQLite via better-sqlite3,
//          or Redis). Keep implementing MemoryStore from @trip/shared so nothing
//          else has to change.

import {
  ChatTurn,
  HitlDecision,
  SavedTrip,
  TripSummary,
  UserPreference,
  type MemoryStore,
} from "@trip/shared";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const shortTerm = new Map<string, ChatTurn[]>();
const longTerm = new Map<string, UserPreference[]>();
const decisions = new Map<string, HitlDecision[]>();
const trips = new Map<string, SavedTrip>();
const file = process.env.TRIP_MEMORY_FILE || "/tmp/ai-trip-planner-memory.json";
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  if (!existsSync(file)) return;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      shortTerm?: Record<string, unknown[]>;
      longTerm?: Record<string, unknown[]>;
      decisions?: Record<string, unknown[]>;
      trips?: Record<string, unknown>;
    };
    const nextShortTerm = new Map<string, ChatTurn[]>();
    const nextLongTerm = new Map<string, UserPreference[]>();
    const nextDecisions = new Map<string, HitlDecision[]>();
    const nextTrips = new Map<string, SavedTrip>();
    for (const [key, value] of Object.entries(raw.shortTerm ?? {}))
      nextShortTerm.set(
        key,
        value.map((v) => ChatTurn.parse(v)),
      );
    for (const [key, value] of Object.entries(raw.longTerm ?? {}))
      nextLongTerm.set(
        key,
        value.map((v) => UserPreference.parse(v)),
      );
    for (const [key, value] of Object.entries(raw.decisions ?? {})) {
      // Pre-versioning decisions cannot be safely applied to a current plan.
      // Ignore only those legacy records instead of discarding the whole file.
      const valid = value.flatMap((item) => {
        const parsed = HitlDecision.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
      nextDecisions.set(key, valid);
    }
    for (const [key, value] of Object.entries(raw.trips ?? {})) {
      const parsed = SavedTrip.safeParse(value);
      if (parsed.success) nextTrips.set(key, parsed.data);
    }
    for (const [key, value] of nextShortTerm) shortTerm.set(key, value);
    for (const [key, value] of nextLongTerm) longTerm.set(key, value);
    for (const [key, value] of nextDecisions) decisions.set(key, value);
    for (const [key, value] of nextTrips) trips.set(key, value);
  } catch {
    // A corrupt cache should not prevent a trip from being planned.
  }
}

function persist() {
  mkdirSync(dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.tmp`;
  writeFileSync(
    temporaryFile,
    JSON.stringify({
      shortTerm: Object.fromEntries(shortTerm),
      longTerm: Object.fromEntries(longTerm),
      decisions: Object.fromEntries(decisions),
      trips: Object.fromEntries(trips),
    }),
    "utf8",
  );
  renameSync(temporaryFile, file);
}

export const memory: MemoryStore = {
  async getShortTerm(tripId) {
    load();
    return shortTerm.get(tripId) ?? [];
  },
  async appendShortTerm(tripId, turn) {
    load();
    shortTerm.set(tripId, [...(shortTerm.get(tripId) ?? []), turn]);
    persist();
  },
  async getLongTerm(userId) {
    load();
    return longTerm.get(userId) ?? [];
  },
  async setLongTerm(userId, pref) {
    load();
    const existing = (longTerm.get(userId) ?? []).filter((p) => p.key !== pref.key);
    longTerm.set(userId, [...existing, pref]);
    persist();
  },
  async promote(tripId, userId, key) {
    load();
    const turn = (shortTerm.get(tripId) ?? []).find((item) => item.content.includes(key));
    if (turn) {
      await this.setLongTerm(userId, { key, value: turn.content, source: "chat_confirmed" });
    }
  },
  async getHitlDecisions(tripId) {
    load();
    return decisions.get(tripId) ?? [];
  },
  async setHitlDecision(tripId, decision) {
    load();
    const existing = (decisions.get(tripId) ?? []).filter(
      (item) => item.checkpointId !== decision.checkpointId,
    );
    decisions.set(tripId, [...existing, decision]);
    persist();
  },
  async listTrips(userId) {
    load();
    return [...trips.values()]
      .filter((trip) => trip.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((trip) =>
        TripSummary.parse({
          tripId: trip.tripId,
          userId: trip.userId,
          title: trip.title,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          destination: trip.plan?.brief.destination,
          planVersion: trip.plan?.planVersion ?? null,
        }),
      );
  },
  async getTrip(tripId) {
    load();
    return trips.get(tripId);
  },
  async saveTrip(trip) {
    load();
    const parsed = SavedTrip.parse(trip);
    trips.set(parsed.tripId, parsed);
    persist();
  },
};
