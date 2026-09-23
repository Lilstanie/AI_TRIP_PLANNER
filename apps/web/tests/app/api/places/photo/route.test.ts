import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleRequestError } from "@/lib/integrations/google";
import { GET } from "@/app/api/places/photo/route";

vi.mock("@/lib/integrations/google", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/google")>(
    "@/lib/integrations/google",
  );
  return { ...actual, placePhotoUri: vi.fn() };
});

const NAME = "places/p1/photos/abc";

function request(query: string) {
  return new Request(`http://localhost/api/places/photo?${query}`);
}

afterEach(() => vi.clearAllMocks());

describe("GET /api/places/photo", () => {
  it.each([
    "",
    `name=${encodeURIComponent(NAME)}`,
    `name=${encodeURIComponent(NAME)}&width=4800`,
    "name=https%3A%2F%2Fevil.example&width=400",
  ])("rejects %j before calling Google", async (query) => {
    const { placePhotoUri } = await import("@/lib/integrations/google");

    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(placePhotoUri).not.toHaveBeenCalled();
  });

  it("redirects to the image without letting anything cache the answer", async () => {
    const { placePhotoUri } = await import("@/lib/integrations/google");
    vi.mocked(placePhotoUri).mockResolvedValue("https://lh3.googleusercontent.com/x=w400");

    const response = await GET(request(`name=${encodeURIComponent(NAME)}&width=400`));

    expect(placePhotoUri).toHaveBeenCalledWith(NAME, 400);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lh3.googleusercontent.com/x=w400");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    [400, 404],
    [404, 404],
    [429, 429],
    [503, 502],
  ])("maps Google's %d to %d", async (upstream, expected) => {
    const { placePhotoUri } = await import("@/lib/integrations/google");
    vi.mocked(placePhotoUri).mockRejectedValue(new GoogleRequestError(upstream));

    const response = await GET(request(`name=${encodeURIComponent(NAME)}&width=160`));

    expect(response.status).toBe(expected);
  });

  it("treats a missing server key as unavailable, not as a missing photo", async () => {
    const { placePhotoUri } = await import("@/lib/integrations/google");
    vi.mocked(placePhotoUri).mockRejectedValue(new Error("Google Maps is not configured."));

    const response = await GET(request(`name=${encodeURIComponent(NAME)}&width=160`));

    expect(response.status).toBe(502);
  });
});
