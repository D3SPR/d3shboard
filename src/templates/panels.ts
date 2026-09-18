// Ready-made custom panels used by templates, and good worked examples of what custom code can do.
// Gotchas they demonstrate: an embed is a sandboxed iframe, so it sets its own colour-scheme,
// keeps a transparent background, loads its own font, and only talks to APIs that allow browser requests.

export const WEATHER_PANEL = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; background: transparent; color-scheme: dark; }
  body { font-family: 'Space Grotesk', system-ui, sans-serif; color: #eef2ff; }
  .wrap { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
  .now { display: flex; align-items: center; gap: 14px; }
  .icon { font-size: clamp(26px, 22vh, 46px); line-height: 1; }
  .temp { font-size: clamp(28px, 24vh, 48px); font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
  .about { min-width: 0; flex: 1; }
  .cond { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; opacity: 0.62; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .days { display: flex; gap: 8px; }
  .day { flex: 1; background: rgba(255, 255, 255, 0.07); border-radius: 12px; padding: 5px 4px; text-align: center; }
  .day .n { font-size: 11px; opacity: 0.6; }
  .day .i { font-size: 19px; line-height: 1.3; }
  .day .t { font-size: 12px; }
  .msg { font-size: 13px; opacity: 0.6; }
  @media (max-height: 118px) { .days { display: none; } }
  @media (max-height: 108px) { .sub:last-child { display: none; } }
</style>
<div class="wrap" id="root"><div class="msg">Loading weather…</div></div>
<script>
  // Change these if the automatic location is wrong.
  const FALLBACK = { lat: 40.7608, lon: -111.891, city: "Salt Lake City" };

  const CODES = {
    0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Cloudy", "☁️"],
    45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
    51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌦️"],
    56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
    61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
    66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
    71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
    80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Heavy showers", "⛈️"],
    85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
    95: ["Thunderstorms", "⛈️"], 96: ["Thunderstorms", "⛈️"], 99: ["Thunderstorms", "⛈️"],
  };
  const look = (code) => CODES[code] || ["—", "•"];
  const root = document.getElementById("root");

  async function locate() {
    try {
      const j = await (await fetch("https://get.geojs.io/v1/ip/geo.json")).json();
      if (j && j.latitude) return { lat: +j.latitude, lon: +j.longitude, city: j.city || j.region || "Your area" };
    } catch {}
    return FALLBACK;
  }

  async function load() {
    try {
      const at = await locate();
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + at.lat + "&longitude=" + at.lon +
        "&current=temperature_2m,apparent_temperature,weather_code" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
        "&temperature_unit=fahrenheit&timezone=auto&forecast_days=4";
      const d = await (await fetch(url)).json();
      const [cond, icon] = look(d.current.weather_code);
      const days = d.daily.time.slice(1, 4).map((t, i) => {
        const n = i + 1;
        const name = new Date(t + "T12:00:00").toLocaleDateString([], { weekday: "short" });
        return '<div class="day"><div class="n">' + name + '</div><div class="i">' + look(d.daily.weather_code[n])[1] +
          '</div><div class="t">' + Math.round(d.daily.temperature_2m_max[n]) + "° " +
          Math.round(d.daily.temperature_2m_min[n]) + "°</div></div>";
      }).join("");
      root.innerHTML =
        '<div class="now"><div class="icon">' + icon + '</div><div class="temp">' +
        Math.round(d.current.temperature_2m) + '°</div><div class="about"><div class="cond">' + cond +
        '</div><div class="sub">Feels ' + Math.round(d.current.apparent_temperature) + "° · H " +
        Math.round(d.daily.temperature_2m_max[0]) + "° L " + Math.round(d.daily.temperature_2m_min[0]) +
        '°</div><div class="sub">' + at.city + '</div></div></div><div class="days">' + days + "</div>";
    } catch {
      root.innerHTML = '<div class="msg">Couldn\\'t load the weather.</div>';
    }
  }

  load();
  setInterval(load, 15 * 60 * 1000);
</script>`;

export const SPORTS_PANEL = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; background: transparent; color-scheme: dark; }
  body { font-family: 'Space Grotesk', system-ui, sans-serif; color: #eef2ff; }
  .list { height: 100%; overflow: auto; display: flex; flex-direction: column; gap: 6px; scrollbar-width: thin; }
  .game { display: flex; align-items: center; gap: 9px; background: rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 7px 9px; }
  .game.live { background: rgba(110, 195, 255, 0.10); box-shadow: inset 0 0 0 1px rgba(110, 195, 255, 0.45); }
  .tag { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.65; width: 42px; flex: none; }
  .teams { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .right { text-align: right; flex: none; }
  .score { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .when { font-size: 12px; opacity: 0.75; font-variant-numeric: tabular-nums; }
  .state { font-size: 10px; opacity: 0.6; white-space: nowrap; }
  .live .state { opacity: 1; color: #8fd4ff; font-weight: 500; }
  .live .tag { opacity: 0.85; color: #8fd4ff; }
  .msg { font-size: 13px; opacity: 0.6; padding: 4px 2px; }
</style>
<div class="list" id="root"><div class="msg">Loading scores…</div></div>
<script>
  const LEAGUES = [
    ["football", "nfl", "NFL"],
    ["football", "college-football", "NCAAF"],
    ["baseball", "mlb", "MLB"],
    ["basketball", "wnba", "WNBA"],
    ["hockey", "nhl", "NHL"],
    ["basketball", "nba", "NBA"],
  ];
  const root = document.getElementById("root");
  const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

  async function league([sport, id, tag]) {
    try {
      const d = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/" + sport + "/" + id + "/scoreboard")).json();
      return (d.events || []).map((e) => {
        const c = e.competitions[0];
        const side = (home) => c.competitors.find((x) => (x.homeAway === "home") === home) || {};
        const pick = (t) => ({ ab: t.team ? t.team.abbreviation || t.team.shortDisplayName : "?", score: t.score });
        return {
          tag,
          state: e.status.type.state,
          detail: e.status.type.shortDetail || "",
          date: e.date,
          away: pick(side(false)),
          home: pick(side(true)),
        };
      });
    } catch {
      return [];
    }
  }

  function render(g) {
    const live = g.state === "in";
    const pre = g.state === "pre";
    const when = new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const right = pre
      ? '<div class="when">' + when + "</div>"
      : '<div class="score">' + esc(g.away.score) + "–" + esc(g.home.score) + "</div>";
    const note = pre ? "" : '<div class="state">' + (live ? "● " : "") + esc(g.detail) + "</div>";
    return '<div class="game' + (live ? " live" : "") + '"><span class="tag">' + g.tag +
      '</span><span class="teams">' + esc(g.away.ab) + " @ " + esc(g.home.ab) +
      '</span><span class="right">' + right + note + "</span></div>";
  }

  async function load() {
    const all = (await Promise.all(LEAGUES.map(league))).flat();
    if (!all.length) {
      root.innerHTML = '<div class="msg">No games listed right now.</div>';
      return;
    }
    const rank = { in: 0, pre: 1, post: 2 };
    all.sort((a, b) => (rank[a.state] - rank[b.state]) || (new Date(a.date) - new Date(b.date)));
    root.innerHTML = all.slice(0, 14).map(render).join("");
  }

  load();
  setInterval(load, 60 * 1000);
</script>`;
