import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, adminToken, isAdminPasscode, isAdminToken } from "@/lib/auth/admin-token";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin passcodes", () => {
  it.each(["admin", "test", "tutor", "ADMIN", "Test", "TuToR", "  tutor  "])(
    "accepts %j",
    (code) => {
      expect(isAdminPasscode(code)).toBe(true);
    },
  );

  it.each(["", " ", "adm", "admin1", "tutors", "administrator", "test test", null, undefined])(
    "rejects %j",
    (code) => {
      expect(isAdminPasscode(code)).toBe(false);
    },
  );
});

describe("admin session token", () => {
  it("accepts the token it issued", async () => {
    expect(await isAdminToken(await adminToken())).toBe(true);
  });

  it.each(["", "admin", "0".repeat(64), undefined])("rejects %j", async (value) => {
    expect(await isAdminToken(value)).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "one");
    const issued = await adminToken();
    vi.stubEnv("ADMIN_SESSION_SECRET", "two");
    expect(await isAdminToken(issued)).toBe(false);
  });

  it("names a stable cookie", () => {
    expect(ADMIN_COOKIE).toBe("trip_admin");
  });
});
