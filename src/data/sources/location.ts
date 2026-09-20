import type { SourceKind } from "../types";
import { fetchJson, num } from "./shared";

export const locationSource: SourceKind = {
  kind: "location",
  label: "Where you are",
  description: "Your rough location, worked out from the internet connection.",
  icon: "pin",
  refreshSec: 3600,
  params: [],
  fields: [
    { key: "city", label: "City", type: "text", example: "Milwaukee" },
    { key: "region", label: "Region", type: "text", example: "Wisconsin" },
    { key: "country", label: "Country", type: "text", example: "United States" },
    { key: "lat", label: "Latitude", type: "number", format: { decimals: 3 }, example: 43.039 },
    { key: "lon", label: "Longitude", type: "number", format: { decimals: 3 }, example: -87.906 },
  ],
  async load() {
    const data = await fetchJson("https://get.geojs.io/v1/ip/geo.json");
    return {
      city: data.city ?? "",
      region: data.region ?? "",
      country: data.country ?? "",
      lat: num(data.latitude),
      lon: num(data.longitude),
    };
  },
};
