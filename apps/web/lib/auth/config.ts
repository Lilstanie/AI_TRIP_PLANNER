/**
 * Accounts are optional. With Clerk keys configured, travellers can sign in and their trips,
 * chats and settings sync to the database; without them — CI, a fresh clone, a deployment whose
 * owner has not added Clerk yet — the workspace runs exactly as before, single-user and local.
 *
 * The publishable key is inlined at build time, so the same check works on server and client.
 */
export const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
