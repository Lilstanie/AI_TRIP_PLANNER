import { describe, expect, it, vi } from "vitest";
import { osmPlaces } from "@/lib/map-provider/osm-places";

const tokyo = {
  osm_type: "relation",
  osm_id: 1543125,
  lat: "35.6812",
  lon: "139.7671",
  name: "東京都",
};
const zhejiang = {
  geometry: { coordinates: [118.98, 29.19] },
  properties: { osm_type: "N", osm_id: 7, name: "东京" },
};

function answers() {
  return vi.fn(async (url: string) =>
    Response.json(url.includes("photon") ? { features: [zhejiang] } : [tokyo]),
  );
}

const host = (fetcher: ReturnType<typeof answers>) =>
  fetcher.mock.calls.map(([url]) => new URL(url).hostname);

describe("Chinese place names in the English interface", () => {
  it("asks Nominatim for Han text, which Photon puts in Zhejiang", async () => {
    const fetcher = answers();

    const [place] = await osmPlaces(fetcher).search({ text: "东京", language: "en" });

    expect(host(fetcher)).toEqual(["nominatim.openstreetmap.org"]);
    expect(place!.location).toEqual({ latitude: 35.6812, longitude: 139.7671 });
  });

  it("keeps Photon for Latin text in the English interface", async () => {
    const fetcher = answers();

    await osmPlaces(fetcher).search({ text: "Tokyo", language: "en" });

    expect(host(fetcher)).toEqual(["photon.komoot.io"]);
  });

  it("never asks Nominatim while the traveller types, whatever the script", async () => {
    const fetcher = answers();

    await osmPlaces(fetcher).search({ text: "东京", language: "en", autocomplete: true });

    expect(host(fetcher)).not.toContain("nominatim.openstreetmap.org");
  });
});
