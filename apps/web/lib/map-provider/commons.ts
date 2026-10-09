import type { PhotoWidth } from "@/lib/integrations/google";
import { NoticeError } from "@/lib/i18n/notice";
import { providerCache, providerJson, type ProviderFetch } from "./http";
import type { MapPlace } from "./types";

export const COMMONS_NAME = /^osm:commons\/[A-Za-z0-9%_.!~*'()-]+$/;
const commonsUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(value);
const plain = (value?: string) => value?.replace(/<[^>]*>/g, "").slice(0, 500);
type Image = { url: string; artist?: string; license?: string; licenseUri?: string };
export function commonsPhotos(fetcher?: ProviderFetch) {
  const cache = providerCache<Image | undefined>();
  async function image(file: string, width: PhotoWidth): Promise<Image | undefined> {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    Object.entries({
      action: "query",
      format: "json",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: String(width),
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    return cache(url.href, async () => {
      const body = (await providerJson(url.href, fetcher)) as {
        query?: {
          pages?: Record<
            string,
            {
              imageinfo?: {
                url?: string;
                thumburl?: string;
                extmetadata?: Record<string, { value?: string }>;
              }[];
            }
          >;
        };
      };
      const info = Object.values(body.query?.pages ?? {})[0]?.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (!commonsUrl(src)) return;
      const meta = info?.extmetadata;
      const license = plain(meta?.LicenseShortName?.value);
      const artist = plain(meta?.Artist?.value);
      const licenseUri = meta?.LicenseUrl?.value;
      if (!license || !artist || !licenseUri || !/^https?:\/\//.test(licenseUri)) return;
      return { url: src, artist, license, licenseUri };
    });
  }
  return {
    async enrich(place: MapPlace): Promise<MapPlace> {
      let file = place.commonsFile;
      try {
        if (!file && place.wikidata) {
          const body = (await providerJson(
            `https://www.wikidata.org/wiki/Special:EntityData/${place.wikidata}.json`,
            fetcher,
          )) as {
            entities?: Record<
              string,
              { claims?: { P18?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } }
            >;
          };
          const value =
            body.entities?.[place.wikidata]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
          if (typeof value === "string") file = value;
        }
        if (!file) return place;
        const photo = await image(file, 400);
        if (!photo) return place;
        return {
          ...place,
          photos: [
            {
              name: `osm:commons/${encodeURIComponent(file)}`,
              authorAttributions: [{ displayName: photo.artist }],
              license: photo.license,
              licenseUri: photo.licenseUri,
            },
          ],
        };
      } catch {
        return place;
      } // An optional image never makes a place unavailable.
    },
    async url(name: string, width: PhotoWidth): Promise<string> {
      if (!COMMONS_NAME.test(name)) throw new NoticeError({ key: "Unknown photo." });
      let file: string;
      try {
        file = decodeURIComponent(name.slice("osm:commons/".length));
      } catch {
        throw new NoticeError({ key: "Unknown photo." });
      }
      const photo = await image(file, width);
      if (!photo) throw new NoticeError({ key: "This photo is no longer available." });
      return photo.url;
    },
  };
}
