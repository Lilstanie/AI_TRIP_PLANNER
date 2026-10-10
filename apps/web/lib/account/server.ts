import { auth } from "@clerk/nextjs/server";
import { authEnabled } from "../auth/config";
import { dbEnabled } from "../db/client";
import { noticeBody, type Notice } from "../i18n/notice";

const json = (status: number, notice: Notice) =>
  Response.json(noticeBody(notice), { status, headers: { "Cache-Control": "no-store" } });

export async function accountUser(): Promise<{ userId: string } | { response: Response }> {
  if (!authEnabled || !dbEnabled())
    return { response: json(503, { key: "Accounts are not available on this deployment." }) };
  const { userId } = await auth();
  if (!userId) return { response: json(401, { key: "Sign in to use your account." }) };
  return { userId };
}

export const badRequest = (notice: Notice) => json(400, notice);
export const noStore = { "Cache-Control": "no-store" } as const;
