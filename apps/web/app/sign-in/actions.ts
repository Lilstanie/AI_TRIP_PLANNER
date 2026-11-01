"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminToken,
  isAdminPasscode,
} from "@/lib/auth/admin-token";

export async function signInWithPasscode(formData: FormData) {
  if (!isAdminPasscode(formData.get("passcode"))) redirect("/sign-in?passcode=wrong");
  const store = await cookies();
  store.set(ADMIN_COOKIE, await adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.VERCEL_ENV),
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/");
}
