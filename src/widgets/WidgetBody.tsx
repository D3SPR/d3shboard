import { useEffect, useMemo, useRef, useState } from "react";
import type { Widget } from "../lib/types";
import { emitWidgetData, formatDate, getPath, useTick } from "../lib/util";

const str = (w: Widget, key: string, fallback = "") => String(w.config[key] ?? fallback);
const num = (w: Widget, key: string, fallback = 0) => Number(w.config[key] ?? fallback);

function Clock({ w }: { w: Widget }) {
  useTick(1000);
  const tz = str(w, "timezone");
  let now = new Date();
  if (tz) {
    try {
      now = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    } catch {
      // Unknown timezone name: fall back to local time.
    }
  }
  const sub = str(w, "sub");
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1">
      <div style={{ fontSize: "2.4em", fontWeight: 700, lineHeight: 1 }}>
        {formatDate(now, str(w, "format", "HH:mm:ss"))}
      </div>
      {sub ? <div style={{ opacity: 0.6, fontSize: "0.85em" }}>{formatDate(now, sub)}</div> : null}
    </div>
  );
}

// "safe center" centres short content but falls back to top-aligned when it overflows, so nothing is clipped.
const centreIfAuto = (w: Widget): React.CSSProperties =>
  w.style.autoFit ? { display: "flex", flexDirection: "column", justifyContent: "safe center" } : {};

function Text({ w }: { w: Widget }) {
  return (
    <div className="h-full w-full overflow-auto whitespace-pre-wrap" style={centreIfAuto(w)}>
      {w.style.autoFit ? <div>{str(w, "text")}</div> : str(w, "text")}
    </div>
  );
}

function Image({ w }: { w: Widget }) {
  return (
    <img
      src={str(w, "url")}
      alt={w.title}
      loading="lazy"
      className="h-full w-full"
      style={{ objectFit: str(w, "fit", "cover") as React.CSSProperties["objectFit"], borderRadius: "inherit" }}
    />
  );
}

function WebPage({ w }: { w: Widget }) {
  return (
    <iframe
      src={str(w, "url")}
      title={w.title}
      className="h-full w-full border-0"
      style={{ borderRadius: "inherit" }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
}

function CustomEmbed({ w }: { w: Widget }) {
  const html = str(w, "html");
  // The reporter lets the page (and the agent bridge) see errors thrown inside this sandboxed frame.
  const doc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;color:inherit;font-family:inherit}</style>` +
      `<script>(function(){var id=${JSON.stringify(w.id)};function send(m){try{parent.postMessage({__d3sh:1,widgetId:id,message:String(m).slice(0,300)},"*")}catch(e){}}` +
      `window.addEventListener("error",function(e){send(e.message||"Script error")});` +
      `window.addEventListener("unhandledrejection",function(e){send((e.reason&&e.reason.message)||e.reason||"Unhandled promise rejection")});` +
      `var ce=console.error;console.error=function(){send(Array.prototype.join.call(arguments," "));ce.apply(console,arguments)};})();<\/script>` +
      `</head><body>${html}</body></html>`,
    [html, w.id],
  );
  return (
    <iframe
      title={w.title}
      srcDoc={doc}
      className="h-full w-full border-0"
      style={{ borderRadius: "inherit" }}
      sandbox="allow-scripts"
    />
  );
}

type FeedItem = { title: string; link: string };

function Feed({ w }: { w: Widget }) {
  const url = str(w, "url");
  const count = num(w, "count", 6);
  const refresh = num(w, "refresh", 15);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTop = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    lastTop.current = null;
    const load = async () => {
      try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!alive) return;
        if (!data.items) throw new Error(data.message || "No items");
        const top = data.items[0]?.link ?? "";
        if (lastTop.current !== null && lastTop.current !== top) emitWidgetData(w.id);
        lastTop.current = top;
        setItems(data.items);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    load();
    const id = setInterval(load, Math.max(1, refresh) * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, refresh, w.id]);

  if (error) return <div style={{ opacity: 0.6 }}>Couldn't load this feed.</div>;
  if (!items) return <div style={{ opacity: 0.5 }}>Loading…</div>;
  return (
    <ul className="flex h-full w-full flex-col gap-2 overflow-auto" style={w.style.autoFit ? { justifyContent: "safe center" } : undefined}>
      {items.slice(0, count).map((item) => (
        <li key={item.link}>
          <a href={item.link} target="_blank" rel="noreferrer" className="block leading-snug hover:underline">
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ApiValue({ w }: { w: Widget }) {
  const url = str(w, "url");
  const path = str(w, "path");
  const refresh = num(w, "refresh", 5);
  const [value, setValue] = useState("…");
  const last = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    last.current = null;
    const load = async () => {
      let next = "—";
      try {
        const found = getPath(await (await fetch(url)).json(), path);
        next = typeof found === "object" && found !== null ? JSON.stringify(found) : String(found ?? "—");
      } catch {
        // Network or JSON error: show the dash placeholder.
      }
      if (!alive) return;
      if (last.current !== null && last.current !== next) emitWidgetData(w.id);
      last.current = next;
      setValue(next);
    };
    load();
    const id = setInterval(load, Math.max(1, refresh) * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, path, refresh, w.id]);

  return (
    <div className="flex h-full w-full items-center">
      <div className="w-full" style={{ fontSize: "1.8em", fontWeight: 700 }}>
        {str(w, "prefix")}
        {value}
        {str(w, "suffix")}
      </div>
    </div>
  );
}

export function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "clock":
      return <Clock w={widget} />;
    case "text":
      return <Text w={widget} />;
    case "image":
      return <Image w={widget} />;
    case "iframe":
      return <WebPage w={widget} />;
    case "feed":
      return <Feed w={widget} />;
    case "api":
      return <ApiValue w={widget} />;
    case "embed":
      return <CustomEmbed w={widget} />;
    default:
      return null;
  }
}
