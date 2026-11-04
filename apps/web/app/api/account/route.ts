import { clerkClient } from "@clerk/nextjs/server";
import { deleteAccountData } from "@/lib/account/deletion";
import { accountUser, noStore } from "@/lib/account/server";
import { noticeBody } from "@/lib/i18n/notice";

export async function DELETE() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  try {
    await deleteAccountData(user.userId);
  } catch (error) {
    console.warn("[account] data deletion failed", error);
    return Response.json(noticeBody({ key: "yourAccountCouldNotBe" }), {
      status: 500,
      headers: noStore,
    });
  }
  try {
    await (await clerkClient()).users.deleteUser(user.userId);
  } catch {
    return Response.json(
      noticeBody({
        key: "yourDataWasDeletedBut",
      }),
      { status: 502, headers: noStore },
    );
  }
  return Response.json({ ok: true }, { headers: noStore });
}
