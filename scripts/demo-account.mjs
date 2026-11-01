#!/usr/bin/env node

import { randomBytes } from "node:crypto";

const email = "demo+clerk_test@example.com";
const secret = process.env.CLERK_SECRET_KEY;

if (!secret) {
  console.error("CLERK_SECRET_KEY is not set. Run with --env-file=apps/web/.env.local.");
  process.exit(1);
}
if (!secret.startsWith("sk_test_")) {
  console.error(
    "Refusing: the demo account belongs only in a Clerk development instance (sk_test_).",
  );
  process.exit(1);
}

const clerk = async (path, method, body) => {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.errors?.map((error) => error.code).join(", ") || "no error code";
    throw new Error(`Clerk ${method} ${path.split("?")[0]}: ${response.status} (${code})`);
  }
  return data;
};

const password = `Demo-${randomBytes(6).toString("base64url")}-2026`;

try {
  const [existing] = await clerk(`/users?email_address=${encodeURIComponent(email)}`, "GET");
  if (existing) {
    await clerk(`/users/${existing.id}`, "PATCH", { password, skip_password_checks: true });
  } else {
    await clerk("/users", "POST", {
      email_address: [email],
      password,
      first_name: "Demo",
      last_name: "Traveller",
      skip_password_checks: true,
    });
  }
  console.log(`${existing ? "Reset" : "Created"} ${email}`);
  console.log(`Password: ${password}`);
  console.log("If Clerk asks for an email code on a new device, enter 424242.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
