import { auth } from "@clerk/nextjs/server";
import { authEnabled } from "../auth/config";
import { dbEnabled } from "../db/client";

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The signed-in Clerk user for an account route, or the response to return instead. Every account
 * query filters by this id, never by an id from the request body, so one user cannot read or write
 * another's records.
 */
export async function accountUser(): Promise<{ userId: string } | { response: Response }> {
  if (!authEnabled || !dbEnabled())
    return { response: json(503, "Accounts are not available on this deployment.") };
  const { userId } = await auth();
  if (!userId) return { response: json(401, "Sign in to use your account.") };
  return { userId };
}

export const badRequest = (error: string) => json(400, error);
export const noStore = { "Cache-Control": "no-store" } as const;
