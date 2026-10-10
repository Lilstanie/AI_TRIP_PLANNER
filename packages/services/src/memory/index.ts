import type { ChatTurn, UserPreference, MemoryStore } from "@trip/shared";
import { jsonStore } from "../durable";

const shortTermKey = (tripId: string) => `trip:memory:short:${tripId}`;
const longTermKey = (userId: string) => `trip:memory:long:${userId}`;

export const memory: MemoryStore = {
  async getShortTerm(tripId) {
    return (await jsonStore.get<ChatTurn[]>(shortTermKey(tripId))) ?? [];
  },
  async appendShortTerm(tripId, turn) {
    const current = (await jsonStore.get<ChatTurn[]>(shortTermKey(tripId))) ?? [];
    await jsonStore.set(shortTermKey(tripId), [...current, turn]);
  },
  async getLongTerm(userId) {
    return (await jsonStore.get<UserPreference[]>(longTermKey(userId))) ?? [];
  },
  async setLongTerm(userId, pref) {
    const existing = ((await jsonStore.get<UserPreference[]>(longTermKey(userId))) ?? []).filter(
      (p) => p.key !== pref.key,
    );
    await jsonStore.set(longTermKey(userId), [...existing, pref]);
  },

  async promote(_tripId, _userId, _key) {},
};
