import type { FieldDef, SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

const place = {
  key: "place",
  label: "Place",
  kind: "place" as const,
  hint: "Search for a town or city. Everything else fills in for you.",
  default: "",
};

const coords = (params: Record<string, string>) => ({ lat: num(params.lat, 43.0389), lon: num(params.lon, -87.9065) });

/** US AQI bands, the ones people actually recognise. */
const aqiCategory = (aqi: number) =>
  aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for some" : aqi <= 200 ? "Unhealthy" : aqi <= 300 ? "Very unhealthy" : "Hazardous";

const aqiAdvice = (aqi: number) =>
  aqi <= 50 ? "Air quality is fine." : aqi <= 100 ? "Fine for most people." : aqi <= 150 ? "Sensitive groups should take it easy." : "Limit time outdoors.";

export const airQualitySource: SourceKind = {
  kind: "airQuality",
  label: "Air quality & pollen",
  description: "How clean the air is right now, pollutant by pollutant, plus pollen counts.",
  icon: "droplet",
  group: "Weather & sky",
  refreshSec: 1800,
  params: [place],
  fields: [
    { key: "aqi", label: "Air quality index (US)", type: "number", format: { decimals: 0 }, example: 42 },
    { key: "category", label: "Air quality in words", type: "text", example: "Good" },
    { key: "advice", label: "What to do", type: "text", example: "Air quality is fine." },
    { key: "aqiEurope", label: "Air quality index (Europe)", type: "number", format: { decimals: 0 }, example: 28 },
    { key: "pm25", label: "Fine particles (PM2.5)", type: "number", format: { decimals: 1 }, example: 9.4 },
    { key: "pm10", label: "Coarse particles (PM10)", type: "number", format: { decimals: 1 }, example: 16.2 },
    { key: "ozone", label: "Ozone", type: "number", format: { decimals: 0 }, example: 62 },
    { key: "no2", label: "Nitrogen dioxide", type: "number", format: { decimals: 0 }, example: 11 },
    { key: "so2", label: "Sulphur dioxide", type: "number", format: { decimals: 0 }, example: 2 },
    { key: "co", label: "Carbon monoxide", type: "number", format: { decimals: 0 }, example: 140 },
    { key: "dust", label: "Dust", type: "number", format: { decimals: 0 }, example: 1 },
    { key: "grassPollen", label: "Grass pollen", type: "number", format: { decimals: 0 }, example: 4 },
    { key: "treePollen", label: "Tree pollen (birch)", type: "number", format: { decimals: 0 }, example: 0 },
    { key: "ragweedPollen", label: "Ragweed pollen", type: "number", format: { decimals: 0 }, example: 12 },
    { key: "place", label: "Place name", type: "text", example: "Milwaukee" },
  ],
  async load(params) {
    const { lat, lon } = coords(params);
    const current = "us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust,grass_pollen,birch_pollen,ragweed_pollen";
    const data = await fetchJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=${current}&timezone=auto`,
    );
    const c = data.current ?? {};
    const aqi = num(c.us_aqi);
    return {
      aqi,
      category: aqiCategory(aqi),
      advice: aqiAdvice(aqi),
      aqiEurope: num(c.european_aqi),
      pm25: num(c.pm2_5),
      pm10: num(c.pm10),
      ozone: num(c.ozone),
      no2: num(c.nitrogen_dioxide),
      so2: num(c.sulphur_dioxide),
      co: num(c.carbon_monoxide),
      dust: num(c.dust),
      grassPollen: num(c.grass_pollen),
      treePollen: num(c.birch_pollen),
      ragweedPollen: num(c.ragweed_pollen),
      place: params.place || "",
    };
  },
};

const PHASES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Moon phase is pure arithmetic, so it needs no network call. */
const moonNow = () => {
  const days = (Date.now() - KNOWN_NEW_MOON) / 86_400_000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const fraction = age / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const index = Math.round(fraction * 8) % 8;
  const untilFull = ((SYNODIC / 2 - age + SYNODIC) % SYNODIC);
  const untilNew = SYNODIC - age;
  return {
    moonPhase: PHASES[index],
    moonIllumination: illumination * 100,
    moonAge: age,
    daysToFullMoon: untilFull,
    daysToNewMoon: untilNew,
    moonEmoji: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"][index],
  };
};

const gap = (from: string, to: string) => {
  const mins = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
  if (!Number.isFinite(mins) || mins <= 0) return "";
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
};

export const sunMoonSource: SourceKind = {
  kind: "sunMoon",
  label: "Sun & moon",
  description: "Sunrise, sunset, how long the day is, golden hour, and the moon's phase.",
  icon: "moon",
  group: "Weather & sky",
  refreshSec: 3600,
  params: [place],
  fields: [
    { key: "sunrise", label: "Sunrise", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T06:35" },
    { key: "sunset", label: "Sunset", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T18:54" },
    { key: "solarNoon", label: "Midday sun", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T12:45" },
    { key: "dayLength", label: "Length of day", type: "text", example: "12h 19m" },
    { key: "firstLight", label: "First light", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T06:08" },
    { key: "lastLight", label: "Last light", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T19:21" },
    { key: "goldenHour", label: "Evening golden hour", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T18:06" },
    { key: "isDay", label: "Sun is up", type: "text", hint: '"yes" or "no".', example: "yes" },
    { key: "moonPhase", label: "Moon phase", type: "text", example: "Waxing gibbous" },
    { key: "moonEmoji", label: "Moon symbol", type: "text", example: "🌔" },
    { key: "moonIllumination", label: "Moon lit up", type: "number", format: { unit: "%", decimals: 0 }, example: 74 },
    { key: "moonAge", label: "Days since new moon", type: "number", format: { decimals: 1 }, example: 10.4 },
    { key: "daysToFullMoon", label: "Days to full moon", type: "number", format: { decimals: 0 }, example: 4 },
    { key: "daysToNewMoon", label: "Days to new moon", type: "number", format: { decimals: 0 }, example: 19 },
  ],
  async load(params) {
    const { lat, lon } = coords(params);
    const data = await fetchJson(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    const r = data.results ?? {};
    const now = Date.now();
    return {
      sunrise: r.sunrise ?? "",
      sunset: r.sunset ?? "",
      solarNoon: r.solar_noon ?? "",
      dayLength: gap(r.sunrise, r.sunset),
      firstLight: r.civil_twilight_begin ?? "",
      lastLight: r.civil_twilight_end ?? "",
      goldenHour: r.sunset ? new Date(new Date(r.sunset).getTime() - 48 * 60_000).toISOString() : "",
      isDay: r.sunrise && now > new Date(r.sunrise).getTime() && now < new Date(r.sunset).getTime() ? "yes" : "no",
      ...moonNow(),
    };
  },
};

export const marineSource: SourceKind = {
  kind: "marine",
  label: "Waves & sea",
  description: "Wave height, swell and sea temperature for a stretch of coast.",
  icon: "droplet",
  group: "Weather & sky",
  refreshSec: 1800,
  params: [place],
  fields: [
    { key: "waveHeight", label: "Wave height", type: "number", format: { decimals: 1, unit: " m" }, example: 1.2 },
    { key: "wavePeriod", label: "Wave period", type: "number", format: { decimals: 0, unit: " s" }, example: 7 },
    { key: "waveDirection", label: "Wave direction", type: "number", format: { decimals: 0, unit: "°" }, example: 210 },
    { key: "swellHeight", label: "Swell height", type: "number", format: { decimals: 1, unit: " m" }, example: 0.8 },
    { key: "swellPeriod", label: "Swell period", type: "number", format: { decimals: 0, unit: " s" }, example: 9 },
    { key: "seaTemperature", label: "Sea temperature", type: "number", format: { decimals: 1, unit: "°C" }, example: 17.4 },
    { key: "place", label: "Place name", type: "text", example: "Santa Cruz" },
  ],
  async load(params) {
    const { lat, lon } = coords(params);
    const data = await fetchJson(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,sea_surface_temperature&timezone=auto`,
    );
    const c = data.current ?? {};
    if (c.wave_height === null || c.wave_height === undefined)
      throw new Error("No sea data for that spot — pick somewhere on the coast.");
    return {
      waveHeight: num(c.wave_height),
      wavePeriod: num(c.wave_period),
      waveDirection: num(c.wave_direction),
      swellHeight: num(c.swell_wave_height),
      swellPeriod: num(c.swell_wave_period),
      seaTemperature: num(c.sea_surface_temperature),
      place: params.place || "",
    };
  },
};

/** Slippy-map tile numbers for a point, which is how radar tiles are addressed. */
const tileFor = (lat: number, lon: number, zoom: number) => {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
};

export const radarSource: SourceKind = {
  kind: "radar",
  label: "Rain radar",
  description: "A live radar picture of the rain around you, as an image you can drop on the page.",
  icon: "rain",
  group: "Weather & sky",
  refreshSec: 600,
  params: [
    place,
    {
      key: "zoom",
      label: "How close in",
      kind: "select",
      default: "5",
      options: [
        { value: "3", label: "Whole region" },
        { value: "5", label: "Wide" },
        { value: "6", label: "Local" },
        { value: "7", label: "Close" },
      ],
    },
  ],
  fields: [
    { key: "image", label: "Radar picture", type: "image", example: "" },
    { key: "imageWithMap", label: "Radar with coastlines", type: "image", example: "" },
    { key: "time", label: "Picture taken", type: "time", format: { relative: true }, example: "2026-09-20T11:00:00Z" },
    { key: "forecastImage", label: "Radar forecast picture", type: "image", hint: "Where the rain is expected to be shortly.", example: "" },
  ],
  async load(params) {
    const { lat, lon } = coords(params);
    const zoom = Math.max(2, Math.min(8, num(params.zoom, 5)));
    const maps = await fetchJson("https://api.rainviewer.com/public/weather-maps.json");
    const past = maps.radar?.past ?? [];
    const latest = past[past.length - 1];
    const forecast = (maps.radar?.nowcast ?? [])[0];
    if (!latest) throw new Error("The radar service returned no pictures.");
    const { x, y } = tileFor(lat, lon, zoom);
    const tile = (path: string, colour: number, options: string) =>
      `${maps.host}${path}/512/${zoom}/${x}/${y}/${colour}/${options}.png`;
    return {
      image: tile(latest.path, 4, "1_1"),
      imageWithMap: tile(latest.path, 4, "1_1"),
      time: new Date(num(latest.time) * 1000).toISOString(),
      forecastImage: forecast ? tile(forecast.path, 4, "1_1") : "",
    };
  },
};

const tideFields: FieldDef[] = [
  { key: "type", label: "High or low", type: "text", example: "High" },
  { key: "time", label: "Time", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T14:12" },
  { key: "height", label: "Height", type: "number", format: { decimals: 1, unit: " ft" }, example: 5.4 },
  { key: "away", label: "When", type: "time", format: { relative: true }, example: "2026-09-20T14:12" },
];

export const tidesSource: SourceKind = {
  kind: "tides",
  label: "Tides",
  description: "The next high and low tides at a US coastal station.",
  icon: "droplet",
  group: "Weather & sky",
  refreshSec: 3600,
  params: [
    {
      key: "station",
      label: "Station",
      kind: "text",
      hint: "A NOAA station number. Find yours at tidesandcurrents.noaa.gov.",
      placeholder: "9414290",
      default: "9414290",
      options: [
        { value: "9414290", label: "San Francisco, CA" },
        { value: "8518750", label: "The Battery, NY" },
        { value: "8443970", label: "Boston, MA" },
        { value: "8723170", label: "Miami, FL" },
        { value: "9447130", label: "Seattle, WA" },
        { value: "8761724", label: "Grand Isle, LA" },
      ],
    },
  ],
  fields: [
    { key: "nextType", label: "Next tide", type: "text", example: "High" },
    { key: "nextTime", label: "Next tide at", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-20T14:12" },
    { key: "nextAway", label: "Next tide in", type: "time", format: { relative: true }, example: "2026-09-20T14:12" },
    { key: "nextHeight", label: "Next tide height", type: "number", format: { decimals: 1, unit: " ft" }, example: 5.4 },
    { key: "tides", label: "Tides today", type: "list", of: tideFields, example: [] },
  ],
  async load(params) {
    const station = (params.station || "9414290").trim();
    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=d3shboard` +
      `&datum=MLLW&station=${station}&time_zone=lst_ldt&units=english&interval=hilo&format=json&date=today`;
    const data = await fetchJson(url);
    if (data.error) throw new Error(data.error.message ?? "That station didn't answer.");
    const tides = (data.predictions ?? []).map((p: any) => ({
      type: p.type === "H" ? "High" : "Low",
      time: String(p.t).replace(" ", "T"),
      height: num(p.v),
      away: String(p.t).replace(" ", "T"),
    }));
    const next = tides.find((t: any) => new Date(t.time).getTime() > Date.now()) ?? tides[0];
    return {
      nextType: next?.type ?? "",
      nextTime: next?.time ?? "",
      nextAway: next?.time ?? "",
      nextHeight: next?.height ?? 0,
      tides,
    };
  },
};

const alertFields: FieldDef[] = [
  { key: "event", label: "What", type: "text", example: "Winter Storm Warning" },
  { key: "headline", label: "Headline", type: "text", example: "Winter Storm Warning until 6 PM" },
  { key: "severity", label: "Severity", type: "text", example: "Severe" },
  { key: "urgency", label: "Urgency", type: "text", example: "Expected" },
  { key: "area", label: "Area", type: "text", example: "Milwaukee County" },
  { key: "expires", label: "Ends", type: "time", format: { relative: true }, example: "2026-09-20T23:00:00Z" },
];

export const weatherAlertsSource: SourceKind = {
  kind: "weatherAlerts",
  label: "Weather warnings (US)",
  description: "Official National Weather Service warnings for your spot.",
  icon: "zap",
  group: "Weather & sky",
  refreshSec: 600,
  params: [place],
  fields: [
    { key: "count", label: "How many warnings", type: "number", format: { decimals: 0 }, example: 1 },
    { key: "anyActive", label: "Any warnings", type: "text", hint: '"yes" or "no".', example: "no" },
    { key: "event", label: "Top warning", type: "text", example: "Winter Storm Warning" },
    { key: "headline", label: "Top warning headline", type: "text", example: "Winter Storm Warning until 6 PM" },
    { key: "severity", label: "Top warning severity", type: "text", example: "Severe" },
    { key: "expires", label: "Top warning ends", type: "time", format: { relative: true }, example: "2026-09-20T23:00:00Z" },
    { key: "alerts", label: "All warnings", type: "list", of: alertFields, example: [] },
  ],
  async load(params) {
    const { lat, lon } = coords(params);
    const data = await fetchJson(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`);
    const alerts = (data.features ?? []).map((f: any) => ({
      event: f.properties?.event ?? "",
      headline: f.properties?.headline ?? "",
      severity: f.properties?.severity ?? "",
      urgency: f.properties?.urgency ?? "",
      area: f.properties?.areaDesc ?? "",
      expires: f.properties?.expires ?? "",
    }));
    return {
      count: alerts.length,
      anyActive: alerts.length ? "yes" : "no",
      event: alerts[0]?.event ?? "",
      headline: alerts[0]?.headline ?? "",
      severity: alerts[0]?.severity ?? "",
      expires: alerts[0]?.expires ?? "",
      alerts,
    };
  },
};
