import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminToken } from "./admin-token";

export async function isAdminRequest(): Promise<boolean> {
  let store: Awaited<ReturnType<typeof cookies>>;
  try {
    store = await cookies();
  } catch {
    return false;
  }
  return isAdminToken(store.get(ADMIN_COOKIE)?.value);
}
