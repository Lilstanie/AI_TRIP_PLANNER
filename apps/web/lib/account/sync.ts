import { z } from "zod";

export const SyncedRecord = z
  .object({
    id: z.string().min(1).max(200),
    updatedAt: z.string().datetime(),
    deleted: z.boolean().optional(),
    record: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.deleted || value.record, "A live record needs its contents.")
  .refine(
    (value) => !value.record || JSON.stringify(value.record).length <= MAX_RECORD_CHARS,
    "A record is too large to sync.",
  );
export type SyncedRecord = z.infer<typeof SyncedRecord>;

export const MAX_RECORD_CHARS = 2_000_000;

export const SyncPush = z.object({
  trips: z.array(SyncedRecord).max(500),
  conversations: z.array(SyncedRecord).max(500),
});
export type SyncPush = z.infer<typeof SyncPush>;
export type SyncPull = SyncPush;
