import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { AccountDeletedError, withAccountWrite } from "@/lib/account/deletion";
import { MAX_SYNC_BODY_BYTES, SyncPush } from "@/lib/account/sync";
import { conversations, trips } from "@/lib/db/schema";
import { listRecords, writeRecords } from "@/lib/account/revision-store";
import { noticeBody, type Notice } from "@/lib/i18n/notice";

const failure = (status: number, notice: Notice) =>
  Response.json(noticeBody(notice), { status, headers: noStore });

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
  const declared = request.headers.get("content-length");
  if (!declared || !/^\d+$/.test(declared)) return failure(411, { key: "invalidSyncRequest" });
  if (Number(declared) > MAX_SYNC_BODY_BYTES) return failure(413, { key: "syncRequestIsTooLarge" });
  const parsed = SyncPush.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return badRequest(issue ? { raw: issue } : { key: "invalidSyncRequest" });
  }
  try {
    const { tripResult, conversationResult } = await withAccountWrite(user.userId, async (tx) => ({
      tripResult: await writeRecords(tx, trips, user.userId, parsed.data.trips),
      conversationResult: await writeRecords(
        tx,
        conversations,
        user.userId,
        parsed.data.conversations,
      ),
    }));
    return Response.json(
      {
        accepted: { trips: tripResult.accepted, conversations: conversationResult.accepted },
        conflicts: { trips: tripResult.conflicts, conversations: conversationResult.conflicts },
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AccountDeletedError)
      return failure(410, { key: "thisAccountIsBeingDeleted" });
    console.warn("[account-sync] push failed", error);
    return failure(500, { key: "yourChangesCouldNotBe" });
  }
}
