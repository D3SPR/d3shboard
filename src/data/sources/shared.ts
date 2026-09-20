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
