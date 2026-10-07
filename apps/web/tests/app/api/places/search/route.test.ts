import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleNotConfiguredError, GoogleRequestError } from "@/lib/integrations/google";
import { POST } from "@/app/api/places/search/route";

vi.mock("@/lib/integrations/google", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/google")>(
    "@/lib/integrations/google",
  );
  return { ...actual, searchPlaces: vi.fn() };
});

function request(body: unknown) {
  return new Request("http://localhost/api/places/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.clearAllMocks());

describe("POST /api/places/search", () => {
  it("rejects a blank query before calling Google", async () => {
    const { searchPlaces } = await import("@/lib/integrations/google");
    const response = await POST(request({ text: "" }));

    expect(response.status).toBe(400);
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("passes text and destination through and returns Google's places", async () => {
    const { searchPlaces } = await import("@/lib/integrations/google");
    vi.mocked(searchPlaces).mockResolvedValue([{ id: "p1" }]);

    const response = await POST(request({ text: "temple", destination: "Kyoto" }));

    expect(searchPlaces).toHaveBeenCalledWith("temple", "Kyoto");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ places: [{ id: "p1" }] });
  });

  it("maps a 429 from Google to a retryable 429, not a generic 502", async () => {
    const { searchPlaces } = await import("@/lib/integrations/google");
    vi.mocked(searchPlaces).mockRejectedValue(new GoogleRequestError(429));

    const response = await POST(request({ text: "temple" }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Google Places is busy. Please retry shortly.",
      notice: { key: "Google Places is busy. Please retry shortly." },
    });
  });

  it("tells a missing key apart from an outage, and does not ask for a retry", async () => {
    const { searchPlaces } = await import("@/lib/integrations/google");
    vi.mocked(searchPlaces).mockRejectedValue(new GoogleNotConfiguredError());

    const response = await POST(request({ text: "temple" }));

    // 503, not 502: the deployment is at fault, and no retry can fix it.
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).not.toMatch(/retry/i);
    expect(body.error).not.toMatch(/MAPS_API_KEY/);
  });

  it("maps every other upstream failure to 502 without leaking provider details", async () => {
    const { searchPlaces } = await import("@/lib/integrations/google");
    vi.mocked(searchPlaces).mockRejectedValue(new GoogleRequestError(500));

    const response = await POST(request({ text: "temple" }));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).not.toMatch(/500|GoogleRequestError/);
    expect(body.notice).toEqual({ key: "Google Places is temporarily unavailable. Please retry." });
  });

  it("refuses an empty search with a keyed notice", async () => {
    const response = await POST(request({ text: " " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a place name to search.",
      notice: { key: "Enter a place name to search." },
    });
  });
});
