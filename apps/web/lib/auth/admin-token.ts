export const ADMIN_COOKIE = "trip_admin";
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

const PASSCODES = new Set(["admin", "test", "tutor"]);
const DEFAULT_SECRET = "elec5620-demo-admin";

export function isAdminPasscode(value: unknown): boolean {
  return typeof value === "string" && PASSCODES.has(value.trim().toLowerCase());
}

export async function adminToken(): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.ADMIN_SESSION_SECRET || DEFAULT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("trip-admin-v1"));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function isAdminToken(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await adminToken();
  if (value.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
