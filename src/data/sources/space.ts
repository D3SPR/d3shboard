import type { FieldDef, SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

const launchFields: FieldDef[] = [
  { key: "name", label: "Mission", type: "text", example: "Starlink Group 12-4" },
  { key: "provider", label: "Launched by", type: "text", example: "SpaceX" },
  { key: "rocket", label: "Rocket", type: "text", example: "Falcon 9" },
  { key: "pad", label: "Launch pad", type: "text", example: "Cape Canaveral SLC-40" },
  { key: "country", label: "Country", type: "text", example: "USA" },
  { key: "time", label: "Lift-off", type: "time", format: { relative: true }, example: "2026-09-21T09:14:00Z" },
  { key: "status", label: "Status", type: "text", example: "Go for launch" },
  { key: "image", label: "Picture", type: "image", example: "" },
];

export const spaceSource: SourceKind = {
  kind: "space",
  label: "Rocket launches & the ISS",
  description: "The next launches anywhere in the world, and where the space station is right now.",
  icon: "sparkles",
  group: "Space & planet",
  refreshSec: 600,
  params: [],
  fields: [
    { key: "nextName", label: "Next mission", type: "text", example: "Starlink Group 12-4" },
    { key: "nextProvider", label: "Next launched by", type: "text", example: "SpaceX" },
    { key: "nextRocket", label: "Next rocket", type: "text", example: "Falcon 9" },
    { key: "nextPad", label: "Next launch pad", type: "text", example: "Cape Canaveral SLC-40" },
    { key: "nextTime", label: "Next lift-off", type: "time", format: { relative: true }, example: "2026-09-21T09:14:00Z" },
    { key: "nextStatus", label: "Next launch status", type: "text", example: "Go for launch" },
    { key: "nextImage", label: "Next launch picture", type: "image", example: "" },
    { key: "launches", label: "Upcoming launches", type: "list", of: launchFields, example: [] },
    { key: "issLatitude", label: "Space station latitude", type: "number", format: { decimals: 2 }, example: 12.44 },
    { key: "issLongitude", label: "Space station longitude", type: "number", format: { decimals: 2 }, example: -54.2 },
    { key: "issAltitude", label: "Space station altitude", type: "number", format: { decimals: 0, unit: " km" }, example: 421 },
    { key: "issSpeed", label: "Space station speed", type: "number", format: { decimals: 0, unit: " km/h" }, example: 27580 },
    { key: "issDaylight", label: "Space station in sunlight", type: "text", example: "yes" },
  ],
  async load() {
    const [launchResult, issResult] = await Promise.allSettled([
      fetchJson("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8"),
      fetchJson("https://api.wheretheiss.at/v1/satellites/25544"),
    ]);
    if (launchResult.status === "rejected" && issResult.status === "rejected")
      throw new Error("Neither the launch schedule nor the space station answered.");

    // The "upcoming" feed still includes rockets that went up in the last few hours.
    const upcoming = (launchResult.status === "fulfilled" ? launchResult.value.results ?? [] : []).filter(
      (l: any) => new Date(l.net ?? 0).getTime() > Date.now() - 3600_000,
    );
    const launches = upcoming.map((l: any) => ({
      name: l.name ?? "",
      provider: l.launch_service_provider?.name ?? "",
      rocket: l.rocket?.configuration?.name ?? "",
      pad: l.pad?.name ?? "",
      country: l.pad?.country_code ?? "",
      time: l.net ?? "",
      status: l.status?.name ?? "",
      image: l.image ?? "",
    }));
    const iss = issResult.status === "fulfilled" ? issResult.value : {};
    const next = launches[0];

    return {
      nextName: next?.name ?? "",
      nextProvider: next?.provider ?? "",
      nextRocket: next?.rocket ?? "",
      nextPad: next?.pad ?? "",
      nextTime: next?.time ?? "",
      nextStatus: next?.status ?? "",
      nextImage: next?.image ?? "",
      launches,
      issLatitude: num(iss.latitude),
      issLongitude: num(iss.longitude),
      issAltitude: num(iss.altitude),
      issSpeed: num(iss.velocity),
      issDaylight: iss.visibility === "daylight" ? "yes" : "no",
    };
  },
};

export const apodSource: SourceKind = {
  kind: "apod",
  label: "Space picture of the day",
  description: "NASA's picture of the day, with its title and explanation.",
  icon: "image",
  group: "Space & planet",
  refreshSec: 3600,
  params: [],
  fields: [
    { key: "image", label: "Picture", type: "image", example: "" },
    { key: "title", label: "Title", type: "text", example: "The Milky Way over Mount Rainier" },
    { key: "explanation", label: "Explanation", type: "text", example: "A long paragraph about the picture." },
    { key: "credit", label: "Credit", type: "text", example: "Giuseppe Petricca" },
    { key: "date", label: "Date", type: "time", format: { pattern: "DD MMM YYYY" }, example: "2026-09-20" },
  ],
  async load() {
    const data = await fetchJson("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true");
    return {
      image: data.media_type === "image" ? data.hdurl || data.url : data.thumbnail_url || "",
      title: data.title ?? "",
      explanation: data.explanation ?? "",
      credit: data.copyright ?? "NASA",
      date: data.date ?? "",
    };
  },
};

const kpLevel = (kp: number) =>
  kp < 3 ? "Quiet" : kp < 4 ? "Unsettled" : kp < 5 ? "Active" : kp < 6 ? "Minor storm" : kp < 7 ? "Moderate storm" : "Strong storm";

export const auroraSource: SourceKind = {
  kind: "aurora",
  label: "Northern lights",
  description: "Geomagnetic activity — how likely the aurora is tonight.",
  icon: "sparkles",
  group: "Space & planet",
  refreshSec: 1800,
  params: [],
  fields: [
    { key: "kp", label: "Kp index", type: "number", format: { decimals: 1 }, example: 3.3 },
    { key: "level", label: "Activity in words", type: "text", example: "Unsettled" },
    { key: "chance", label: "Chance of a show", type: "text", example: "Possible far north" },
    { key: "maxToday", label: "Highest Kp today", type: "number", format: { decimals: 1 }, example: 4.7 },
    { key: "updated", label: "Measured", type: "time", format: { relative: true }, example: "2026-09-20T09:00:00Z" },
  ],
  async load() {
    const rows = await fetchJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
    const readings = (Array.isArray(rows) ? rows : []).filter((r: any) => r.Kp !== undefined);
    const latest = readings[readings.length - 1];
    if (!latest) throw new Error("No space weather readings came back.");
    const kp = num(latest.Kp);
    const today = readings.filter((r: any) => String(r.time_tag).slice(0, 10) === new Date().toISOString().slice(0, 10));
    return {
      kp,
      level: kpLevel(kp),
      chance: kp < 4 ? "Unlikely except far north" : kp < 5 ? "Possible far north" : kp < 6 ? "Likely at high latitudes" : "Visible well south tonight",
      maxToday: today.length ? Math.max(...today.map((r: any) => num(r.Kp))) : kp,
      updated: latest.time_tag ? `${latest.time_tag}Z` : "",
    };
  },
};

const quakeFields: FieldDef[] = [
  { key: "magnitude", label: "Magnitude", type: "number", format: { decimals: 1 }, example: 5.2 },
  { key: "place", label: "Where", type: "text", example: "112 km SW of Tokyo, Japan" },
  { key: "time", label: "When", type: "time", format: { relative: true }, example: "2026-09-20T08:10:00Z" },
  { key: "depth", label: "Depth", type: "number", format: { decimals: 0, unit: " km" }, example: 35 },
  { key: "distance", label: "Distance from you", type: "number", format: { decimals: 0, unit: " km" }, example: 8400 },
];

const distanceKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export const earthquakeSource: SourceKind = {
  kind: "earthquakes",
  label: "Earthquakes",
  description: "Recent quakes worldwide, the biggest one, and the closest to you.",
  icon: "activity",
  group: "Space & planet",
  refreshSec: 900,
  params: [
    {
      key: "feed",
      label: "Which quakes",
      kind: "select",
      default: "4.5_day",
      options: [
        { value: "significant_week", label: "Significant, this week" },
        { value: "4.5_day", label: "Magnitude 4.5+, today" },
        { value: "2.5_day", label: "Magnitude 2.5+, today" },
        { value: "all_hour", label: "Everything, past hour" },
      ],
    },
    { key: "place", label: "Near", kind: "place", hint: "Used to work out the closest quake to you.", default: "" },
  ],
  fields: [
    { key: "count", label: "How many", type: "number", format: { decimals: 0 }, example: 12 },
    { key: "biggestMagnitude", label: "Biggest magnitude", type: "number", format: { decimals: 1 }, example: 6.1 },
    { key: "biggestPlace", label: "Biggest, where", type: "text", example: "Off the coast of Chile" },
    { key: "biggestTime", label: "Biggest, when", type: "time", format: { relative: true }, example: "2026-09-20T04:00:00Z" },
    { key: "nearestMagnitude", label: "Closest magnitude", type: "number", format: { decimals: 1 }, example: 3.2 },
    { key: "nearestPlace", label: "Closest, where", type: "text", example: "40 km N of Reno, Nevada" },
    { key: "nearestDistance", label: "Closest, how far", type: "number", format: { decimals: 0, unit: " km" }, example: 2400 },
    { key: "quakes", label: "All of them", type: "list", of: quakeFields, example: [] },
  ],
  async load(params) {
    const feed = params.feed || "4.5_day";
    const data = await fetchJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`);
    const lat = num(params.lat, 43.0389);
    const lon = num(params.lon, -87.9065);
    const quakes = (data.features ?? []).map((f: any) => ({
      magnitude: num(f.properties?.mag),
      place: f.properties?.place ?? "",
      time: f.properties?.time ? new Date(num(f.properties.time)).toISOString() : "",
      depth: num(f.geometry?.coordinates?.[2]),
      distance: distanceKm(lat, lon, num(f.geometry?.coordinates?.[1]), num(f.geometry?.coordinates?.[0])),
    }));
    const biggest = [...quakes].sort((a, b) => b.magnitude - a.magnitude)[0];
    const nearest = [...quakes].sort((a, b) => a.distance - b.distance)[0];
    return {
      count: quakes.length,
      biggestMagnitude: biggest?.magnitude ?? 0,
      biggestPlace: biggest?.place ?? "",
      biggestTime: biggest?.time ?? "",
      nearestMagnitude: nearest?.magnitude ?? 0,
      nearestPlace: nearest?.place ?? "",
      nearestDistance: nearest?.distance ?? 0,
      quakes,
    };
  },
};
