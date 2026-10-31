import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { undoAccountMemory } from "@/lib/account/memory";

export async function POST(request: Request) {
  const account = await accountUser();
  if ("response" in account) return account.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string")
    return badRequest({ key: "theRequestWasInvalidPlease" });
  const undone = await undoAccountMemory(account.userId, body.token);
  return Response.json({ undone }, { headers: noStore });
}
