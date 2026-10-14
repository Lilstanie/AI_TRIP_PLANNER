import { z } from "zod";
import { eq } from "drizzle-orm";
import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { UserSettings } from "@/lib/account/settings";
import { getDb } from "@/lib/db/client";
import { userSettings } from "@/lib/db/schema";
import { writeSettings } from "@/lib/account/revision-store";

export async function GET() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const [row] = await getDb()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.userId));
  const parsed = row ? UserSettings.safeParse(row.settings) : undefined;
  return Response.json(
    { settings: parsed?.success ? parsed.data : null, revision: row?.revision ?? 0 },
    { headers: noStore },
  );
}

export async function PUT(request: Request) {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const parsed = z
    .object({
      settings: UserSettings,
      revision: z.number().int().min(0).max(2_147_483_646),
    })
    .safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return badRequest({ key: "Those settings are not valid." });
  const { settings, revision } = parsed.data;
  const rows = await writeSettings(user.userId, settings, revision);
  if (!rows[0]) return Response.json({ conflict: true }, { status: 409, headers: noStore });
  return Response.json(
    { settings: rows[0].settings, revision: rows[0].revision },
    { headers: noStore },
  );
}
