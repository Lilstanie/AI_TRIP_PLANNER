import { eq } from "drizzle-orm";
import { accountUser } from "@/lib/account/server";
import { getDb } from "@/lib/db/client";
import { conversations, trips, userSettings } from "@/lib/db/schema";

/** Everything the account holds, as a JSON download. */
export async function GET() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const db = getDb();
  const [settings, tripRows, conversationRows] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, user.userId)),
    db.select().from(trips).where(eq(trips.userId, user.userId)),
    db.select().from(conversations).where(eq(conversations.userId, user.userId)),
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    settings: settings[0]?.settings ?? null,
    trips: tripRows.filter((row) => !row.deletedAt).map((row) => row.record),
    conversations: conversationRows.filter((row) => !row.deletedAt).map((row) => row.record),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ai-trip-planner-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}
