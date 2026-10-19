import { eq } from "drizzle-orm";
import { getDb, dbEnabled } from "../db/client";
import { userSettings } from "../db/schema";
import { UserSettings } from "./settings";

export async function accountMemoryEnabled(userId?: string): Promise<boolean> {
  if (!userId || !dbEnabled()) return false;
  try {
    const [row] = await getDb().select().from(userSettings).where(eq(userSettings.userId, userId));
    if (!row) return true;
    const parsed = UserSettings.safeParse(row.settings);
    return parsed.success && parsed.data.assistant.memory;
  } catch (error) {
    console.warn("[account-memory] settings read failed; memory disabled", error);
    return false;
  }
}
