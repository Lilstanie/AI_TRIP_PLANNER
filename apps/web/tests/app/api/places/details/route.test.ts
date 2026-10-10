import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetMapProviders } from "@/lib/map-provider";
import { MapProviderUnavailableError } from "@/lib/map-provider/errors";
import { GoogleRequestError } from "@/lib/integrations/google";
import { POST } from "@/app/api/places/details/route";

vi.mock("@/lib/integrations/google", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/google")>(
    "@/lib/integrations/google",
  );
  return { ...actual, placeDetails: vi.fn() };
});

function request(body: unknown) {
  return new Request("http://localhost/api/places/details", {
    method: "POST",
    headers: { "x-trip-data-mode": "live" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.stubEnv("WEB_MAPS_PROVIDER", "google"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetMapProviders();
});

describe("POST /api/places/details", () => {
  it("keeps provider unavailability distinct from a missing resource", async () => {
    const { placeDetails } = await import("@/lib/integrations/google");
    vi.mocked(placeDetails).mockRejectedValue(
      new MapProviderUnavailableError("google", "upstream"),
    );

    const response = await POST(request({ placeId: "p1" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "The map service is temporarily unavailable. Please retry.",
      notice: { key: "The map service is temporarily unavailable. Please retry." },
    });
  });

  it("rejects a missing place id before calling Google", async () => {
    const { placeDetails } = await import("@/lib/integrations/google");
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(placeDetails).not.toHaveBeenCalled();
  });

  it("returns Google's place details for a valid id", async () => {
    const { placeDetails } = await import("@/lib/integrations/google");
    vi.mocked(placeDetails).mockResolvedValue({ id: "p1" });

    const response = await POST(request({ placeId: "p1" }));

    expect(placeDetails).toHaveBeenCalledWith("p1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ place: { id: "p1" }, source: "google" });
  });

  it.each([400, 404])(
    "treats a %d from Google as the saved place no longer existing (404), not a retry-me error",
    async (upstreamStatus) => {
      const { placeDetails } = await import("@/lib/integrations/google");
      vi.mocked(placeDetails).mockRejectedValue(new GoogleRequestError(upstreamStatus));

      const response = await POST(request({ placeId: "stale-id" }));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: "This saved place is no longer available.",
        notice: { key: "This saved place is no longer available." },
      });
    },
  );

  it("maps a 429 to a retryable 429", async () => {
    const { placeDetails } = await import("@/lib/integrations/google");
    vi.mocked(placeDetails).mockRejectedValue(new GoogleRequestError(429));

    const response = await POST(request({ placeId: "p1" }));

    expect(response.status).toBe(429);
  });

  it("maps an unexpected upstream failure to 502", async () => {
    const { placeDetails } = await import("@/lib/integrations/google");
    vi.mocked(placeDetails).mockRejectedValue(new GoogleRequestError(503));

    const response = await POST(request({ placeId: "p1" }));

    expect(response.status).toBe(502);
  });
});
