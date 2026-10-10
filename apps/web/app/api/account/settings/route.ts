import { eq, sql } from "drizzle-orm";
import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { UserSettings } from "@/lib/account/settings";
import { getDb } from "@/lib/db/client";
import { userSettings } from "@/lib/db/schema";

export async function GET() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const [row] = await getDb()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.userId));
  const parsed = row ? UserSettings.safeParse(row.settings) : undefined;
  return Response.json({ settings: parsed?.success ? parsed.data : null }, { headers: noStore });
}

export async function PUT(request: Request) {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const parsed = UserSettings.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return badRequest({ key: "Those settings are not valid." });
  const settings = parsed.data;
  const [row] = await getDb()
    .insert(userSettings)
    .values({ userId: user.userId, settings, updatedAt: new Date(settings.updatedAt) })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { settings, updatedAt: new Date(settings.updatedAt) },
      setWhere: sql`excluded.updated_at > ${userSettings.updatedAt}`,
    })
    .returning();
  if (row) return Response.json({ settings: row.settings }, { headers: noStore });

  const [stored] = await getDb()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.userId));
  return Response.json({ settings: stored?.settings ?? settings }, { headers: noStore });
}
