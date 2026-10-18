import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { deleteAccountMemory, getAccountMemories } from "@/lib/account/memory";

export async function GET() {
  const account = await accountUser();
  if ("response" in account) return account.response;
  return Response.json(
    { memories: await getAccountMemories(account.userId) },
    { headers: noStore },
  );
}

export async function DELETE(request: Request) {
  const account = await accountUser();
  if ("response" in account) return account.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(body.key))
    return badRequest({ key: "The request was invalid. Please retry." });
  const deleted = await deleteAccountMemory(account.userId, body.key);
  return Response.json({ deleted }, { headers: noStore });
}
