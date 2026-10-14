import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { SyncPush } from "@/lib/account/sync";
import { conversations, trips } from "@/lib/db/schema";
import { listRecords, writeRecords } from "@/lib/account/revision-store";

export async function GET() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const [tripRows, conversationRows] = await Promise.all([
    listRecords(trips, user.userId),
    listRecords(conversations, user.userId),
  ]);
  return Response.json({ trips: tripRows, conversations: conversationRows }, { headers: noStore });
}

export async function POST(request: Request) {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const parsed = SyncPush.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return badRequest(issue ? { raw: issue } : { key: "Invalid sync request." });
  }
  const tripResult = await writeRecords(trips, user.userId, parsed.data.trips);
  const conversationResult = await writeRecords(
    conversations,
    user.userId,
    parsed.data.conversations,
  );
  return Response.json(
    {
      accepted: { trips: tripResult.accepted, conversations: conversationResult.accepted },
      conflicts: { trips: tripResult.conflicts, conversations: conversationResult.conflicts },
    },
    { headers: noStore },
  );
}
