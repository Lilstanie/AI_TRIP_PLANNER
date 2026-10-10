import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetMapProviders } from "@/lib/map-provider";
import { POST } from "@/app/api/routes/from-location/route";

vi.mock("@/lib/integrations/google", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/google")>(
    "@/lib/integrations/google",
  );
  return { ...actual, requestGoogleRouteFromCoordinates: vi.fn() };
});

function request(body: unknown) {
  return new Request("http://localhost/api/routes/from-location", {
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

const validBody = { latitude: -33.86, longitude: 151.21, placeId: "place-1", mode: "WALK" };

describe("POST /api/routes/from-location", () => {
  it("forwards valid coordinates and returns the computed route", async () => {
    const { requestGoogleRouteFromCoordinates } = await import("@/lib/integrations/google");
    vi.mocked(requestGoogleRouteFromCoordinates).mockResolvedValue({
      from: "current-location",
      to: "place-1",
      mode: "WALK",
      status: "ok",
      durationMin: 5,
    });

    const response = await POST(request(validBody));

    expect(requestGoogleRouteFromCoordinates).toHaveBeenCalledWith(
      { latitude: -33.86, longitude: 151.21 },
      "place-1",
      "WALK",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      durationMin: 5,
      source: "google",
    });
  });

  it.each([
    { ...validBody, latitude: 91 },
    { ...validBody, longitude: -181 },
    { ...validBody, placeId: "" },
    { ...validBody, mode: "DRIVE" },
    { latitude: -33.86, longitude: 151.21 },
  ])("rejects an invalid request body with 400 instead of calling Google", async (body) => {
    const { requestGoogleRouteFromCoordinates } = await import("@/lib/integrations/google");

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(requestGoogleRouteFromCoordinates).not.toHaveBeenCalled();
  });

  it("returns an unavailable route with the original message, shown as received, when the lookup fails", async () => {
    const { requestGoogleRouteFromCoordinates } = await import("@/lib/integrations/google");
    vi.mocked(requestGoogleRouteFromCoordinates).mockRejectedValue(new Error("boom"));

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "unavailable",
      error: "boom",
      notice: { raw: "boom" },
    });
  });

  it("returns an authored route failure as a keyed notice", async () => {
    const { requestGoogleRouteFromCoordinates } = await import("@/lib/integrations/google");
    const { NoticeError } = await import("@/lib/i18n/notice");
    vi.mocked(requestGoogleRouteFromCoordinates).mockRejectedValue(
      new NoticeError({ key: "No verified route was returned." }),
    );

    const response = await POST(request(validBody));

    await expect(response.json()).resolves.toMatchObject({
      status: "unavailable",
      error: "No verified route was returned.",
      notice: { key: "No verified route was returned." },
    });
  });
});
