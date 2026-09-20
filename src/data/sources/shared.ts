/** Every source fetches straight from the browser, so endpoints must allow cross-origin requests. */
export async function fetchJson(url: string, timeoutMs = 12_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`The service answered ${res.status}.`);
    return await res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("The service took too long to answer.");
    if (e instanceof TypeError) throw new Error("Couldn't reach the service from this browser.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", "#39": "'", "#8217": "’", "#8216": "‘", "#8220": "“", "#8221": "”",
};

/** Feeds arrive as XML, so their text is full of entities. Decoded without touching the DOM. */
export const decodeEntities = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    const key = name.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number(key.slice(1)));
    return whole;
  });
