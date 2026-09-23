import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleRequestError, placeDetails, placePhotoUri } from "@/lib/integrations/google";

const NAME = "places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUc7tXV-abc_123";

function stubFetch(impl: (url: string, init?: RequestInit) => Response) {
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    impl(String(url), init),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MAPS_API_KEY;
});

describe("place photos in lookups", () => {
  it("asks for photos and keeps each name with its author attribution", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({
        id: "p1",
        photos: [
          {
            name: NAME,
            widthPx: 4032,
            heightPx: 3024,
            authorAttributions: [{ displayName: "Ada", uri: "https://maps.google.com/ada" }],
          },
        ],
      }),
    );

    const place = await placeDetails("p1");

    expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      "X-Goog-FieldMask": expect.stringContaining("photos"),
    });
    expect(place.photos).toEqual([
      {
        name: NAME,
        widthPx: 4032,
        heightPx: 3024,
        authorAttributions: [{ displayName: "Ada", uri: "https://maps.google.com/ada" }],
      },
    ]);
  });
});

describe("placePhotoUri", () => {
  it("asks for the image URL instead of the bytes, with the key in a header", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({
        name: `${NAME}/media`,
        photoUri: "https://lh3.googleusercontent.com/x=w400",
      }),
    );

    await expect(placePhotoUri(NAME, 400)).resolves.toBe(
      "https://lh3.googleusercontent.com/x=w400",
    );

    const [url, init] = fetcher.mock.calls[0]!;
    const requested = new URL(String(url));
    expect(requested.origin + requested.pathname).toBe(
      `https://places.googleapis.com/v1/${NAME}/media`,
    );
    expect(requested.searchParams.get("maxWidthPx")).toBe("400");
    expect(requested.searchParams.get("skipHttpRedirect")).toBe("true");
    expect(requested.searchParams.has("key")).toBe(false);
    expect(init?.headers).toMatchObject({ "X-Goog-Api-Key": "test-key" });
  });

  it.each(["places/p1", "places/p1/photos/a/../../x", "https://evil.example/photo", ""])(
    "refuses %j without calling Google",
    async (name) => {
      process.env.MAPS_API_KEY = "test-key";
      const fetcher = stubFetch(() => Response.json({}));

      await expect(placePhotoUri(name, 400)).rejects.toEqual(new GoogleRequestError(400));
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([
    "http://lh3.googleusercontent.com/x",
    "https://evil.example/x",
    "https://googleusercontent.com.evil.example/x",
    "not a url",
  ])("never hands back %j as the image to load", async (photoUri) => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => Response.json({ photoUri }));

    await expect(placePhotoUri(NAME, 400)).rejects.toEqual(new GoogleRequestError(502));
  });

  it("passes Google's status through for the route to map", async () => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => new Response("{}", { status: 429 }));

    await expect(placePhotoUri(NAME, 160)).rejects.toEqual(new GoogleRequestError(429));
  });
});
