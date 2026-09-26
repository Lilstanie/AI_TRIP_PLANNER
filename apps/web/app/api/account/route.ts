import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { accountUser, noStore } from "@/lib/account/server";
import { getDb } from "@/lib/db/client";
import { conversations, trips, userSettings } from "@/lib/db/schema";

/**
 * Deletes the account: its data first, then the Clerk user. If Clerk fails the data is already
 * gone, and the error says so rather than reporting a half-finished deletion as done.
 */
export async function DELETE() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const db = getDb();
  await db.delete(trips).where(eq(trips.userId, user.userId));
  await db.delete(conversations).where(eq(conversations.userId, user.userId));
  await db.delete(userSettings).where(eq(userSettings.userId, user.userId));
  try {
    await (await clerkClient()).users.deleteUser(user.userId);
  } catch {
    return Response.json(
      { error: "Your data was deleted, but the sign-in account could not be. Try again." },
      { status: 502, headers: noStore },
    );
  }
  return Response.json({ ok: true }, { headers: noStore });
}
