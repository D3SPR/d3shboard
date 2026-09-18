import { PRESETS } from "../src/animations/presets.ts";
import { PROPERTIES } from "../src/animations/properties.ts";
import { BREAKPOINTS, FONTS, defaultStyle } from "../src/lib/board.ts";
import { WIDGET_DEFAULTS } from "../src/widgets/defaults.ts";

const CONFIG_DOCS: Record<string, { about: string; keys: Record<string, string> }> = {
  clock: {
    about: "Live time and date.",
    keys: {
      format: "Main line pattern. Tokens: HH (24h hour), hh/h (12h hour), mm, ss, A/a (AM/PM), dddd (day name), ddd (short day), DD (day of month), MMMM (month name), MMM (short month), MM (month number), YYYY, YY. Other text is shown as-is.",
      sub: 'Second line pattern (same tokens). "" hides it.',
      timezone: 'IANA zone like "Asia/Tokyo". "" uses the viewer\'s local time.',
    },
  },
  text: { about: "Plain text note. Newlines are kept.", keys: { text: "The text." } },
  image: { about: "Picture from a URL.", keys: { url: "Image URL.", fit: "cover | contain | fill" } },
  iframe: {
    about: "Shows a website. Many large sites refuse to be embedded and will appear blank.",
    keys: { url: "Page URL." },
  },
  feed: {
    about: "Headlines from an RSS feed (fetched through api.rss2json.com). Emits dataChange when the top headline changes.",
    keys: { url: "RSS feed URL.", count: "Headlines shown (number).", refresh: "Minutes between checks (number)." },
  },
  api: {
    about: "One live value from a JSON URL. The URL must allow browser requests (CORS). Emits dataChange when the value changes.",
    keys: {
      url: "JSON endpoint.",
      path: 'Dot path to the value, array indexes as numbers, e.g. "data.0.price". "" shows the whole response.',
      prefix: "Text before the value.",
      suffix: "Text after the value.",
      refresh: "Minutes between checks (number).",
    },
  },
  embed: {
    about: "Custom HTML with scripts, rendered in a sandboxed iframe with a transparent background. Set your own colours and fonts inside.",
    keys: { html: "HTML document body." },
  },
};

export function buildGuide() {
  const screenNames: Record<string, string> = { sm: "phone", md: "tablet", lg: "computer" };
  const screens = BREAKPOINTS.map((b) => `${screenNames[b.key]} (${b.width}px wide)`).join(", ");
  const widgets = Object.entries(WIDGET_DEFAULTS)
    .map(([type, def]) => {
      const docs = CONFIG_DOCS[type];
      const keys = Object.entries(docs.keys)
        .map(([k, v]) => `  - \`${k}\` (default ${JSON.stringify(def.config[k])}): ${v}`)
        .join("\n");
      return `- **${type}** — ${docs.about} Default size ${def.w}×${def.h}.\n${keys}`;
    })
    .join("\n");
  const presets = PRESETS.map((p) => `  - \`${p.key}\` — ${p.label} (${p.group}): ${p.description}`).join("\n");
  const properties = PROPERTIES.map(
    (p) => `  - \`${p.key}\` — ${p.label}: ${p.hint} Example from ${JSON.stringify(p.defaults.from)} to ${JSON.stringify(p.defaults.to)}.`,
  ).join("\n");

  return `# Building d3shboard dashboards

## How it fits together
- A dashboard has **pages**. Each page has a theme (accent colour, font, background, grid), **components** (called widgets in the API) and **animations**. **Automations** belong to the whole dashboard.
- Your changes apply live in the user's open browser tab and save automatically. \`undo_last_change\` reverts your latest change (up to 30 steps).
- Good workflow: \`list_templates\` → \`apply_template\` (or build by hand) → adapt → **\`check_dashboard\`** → fix what it reports → repeat. Don't remove the user's existing content unless they ask; adding a page leaves their work alone.
- **You cannot see the dashboard.** \`check_dashboard\` is your eyes: it reports components off the edge or below the fold, overlaps, unreadable colours, failed feeds and live values, content cut off, and errors thrown inside custom panels. A layout that looks right in JSON is regularly broken on screen. It can only inspect real rendering for the page that is currently open, so \`set_view\` to a page before checking it.
- Ids are returned by every add_* tool. Omitting \`pageId\` means the page currently open in the editor.

## Layout
- Components are absolutely positioned in CSS pixels from the page's top-left: \`x\`, \`y\`, \`w\` (min 80), \`h\` (min 60). Higher \`z\` sits in front.
- The page does **not** scroll. On a computer keep everything within roughly 1400×800; on a phone within 390×750.
- There are three separate layouts: ${screens}. Content and style are shared; position, size and \`hidden\` are per screen.
- \`add_widget\` with \`layout\` sets the computer position and squeezes phone and tablet into their width. That squeeze only shifts things left, so components that sit side by side on a computer will usually **overlap on tablet and phone**. Always lay out tablet and phone yourself with \`set_widget_layout\`. On phones, stack components in one column (x 20, w 350).
- The editor grid is 20px by default; multiples of 20 with 40px margins look tidy.

## Component types
${widgets}

## Component style (all fields optional, merged into the current style)
Defaults for new components: \`${JSON.stringify(defaultStyle())}\`
- **\`autoFit\`** (on for new components): text size and \`padding\` scale with the box, and content is centred horizontally and vertically. The scale is min(width ÷ default width, height ÷ default height) for that component type, applied separately per screen, so making a box bigger makes its content bigger. While it's on, \`fontSize\`, \`padding\` and \`align\` are ignored. Setting any of them turns \`autoFit\` off (pass \`autoFit: true\` in the same call to keep it on). \`get_dashboard\` reports the calculated values as \`autoFitResult\`. Prefer leaving autoFit on and sizing the box instead of setting a font size.
- \`bg\`: any CSS background. Use 8-digit hex for transparency (e.g. #15131fE6) or a gradient.
- \`fg\` text colour, \`border\` colour, \`borderWidth\` 0–12, \`radius\` 0–60, \`padding\` 0–120.
- \`fontFamily\`: "inherit" (page font) or one of ${FONTS.map((f) => `"${f}"`).join(", ")}. \`fontSize\` 6–240, \`fontWeight\` 100–900, \`letterSpacing\` -3–12, \`align\` left|center|right.
- \`opacity\` 0.1–1, \`shadow\` none|soft|hard|glow (glow uses the page accent), \`blur\` true for frosted glass behind see-through backgrounds.
- \`animation\`: none|float|pulse|fade|slide — a gentle never-ending idle motion. For anything else use animations below.
- \`showTitle\` (on the component, not in style) shows the component's title as a small heading.

## Page theme
- \`accent\` hex colour (buttons, outlines, glow), \`fontFamily\` from the list above.
- \`background\`: { kind: solid|gradient|image, color, color2, angle (deg), imageUrl, imageFit: cover|contain|repeat, dim: 0–0.8 darkening }.
- \`snap\`, \`gridSize\` (5–80), \`showGrid\` only affect the editor.

## Animations
Stored per page and may only reference components on that page. They play in viewing mode (use \`set_view\` with mode "viewing" to let the user see them).
- **trigger**: \`pageShown\` | \`loop\` (forever) | \`click\` {widgetId} | \`hover\` {widgetId} | \`every\` {seconds} | \`timeOfDay\` {at: "HH:MM"} | \`dataChange\` {widgetId of a feed or api component} | \`automation\` {automationId} (fires when that rule becomes true).
- **target**: { widgetId: a component id, "@trigger" (the component that fired a click/hover/dataChange trigger) or "@all" (every component on the page); part: whole | card (box styling, best for colours/glow) | title | content }.
- **effect**:
  - \`{ kind: "preset", preset }\`:
${presets}
  - \`{ kind: "property", property, from, to }\` — \`from: ""\` starts from the current look:
${properties}
  - \`{ kind: "custom", html, css, js }\`: In CSS, \`.target\` selects the animated element and \`.overlay\` the injected HTML layer, only while playing. CSS variables: --dx-duration, --dx-delay, --dx-easing, --dx-repeat, --dx-direction, --dx-fill, --dx-accent. HTML is placed in an absolutely positioned layer over the component. JS runs as a function body with \`el\`, \`overlay\` and \`api\` { done(), animate(keyframes, options), wait(ms), accent, duration }; it may return a cleanup function. JS runs directly in the dashboard page, so prefer presets or CSS when they can do the job.
- **timing** (optional; preset-specific defaults apply): { duration ms, delay ms, easing (CSS easing, e.g. "ease-in-out", "cubic-bezier(.34,1.56,.64,1)"), repeat (0 = forever), alternate, keepEnd (hold the final frame) }.

## Automations
A rule applies its actions while **all** its conditions are true, only in viewing mode, and reverts when they stop being true. Checked about every 20 seconds.
- conditions: \`timeRange\` {from, to "HH:MM", may wrap past midnight} | \`weekday\` {days: 0=Sun…6=Sat} | \`monthday\` {days: 1–31} | \`month\` {months: 1–12} | \`dataValue\` {url, path, op: is|isNot|contains|gt|lt, value (string)}.
- actions: \`setPanel\` {panelId} | \`setAccent\` {color} | \`setFont\` {fontFamily} | \`setBackground\` {background} | \`setWidgetVisible\` {widgetId (any page), visible}.

## Custom panels: the things that go wrong
A \`embed\` component is a **sandboxed iframe**. It shares nothing with the page, which trips up almost every first attempt:
- It does **not** inherit the dashboard's dark theme. With no background of its own the browser paints it **white**, so light text becomes invisible. Always start its CSS with \`html, body { background: transparent; color-scheme: dark; }\`.
- It does **not** inherit the page font. \`@import\` the font you want, or use \`system-ui\`.
- Scripts run, but there is no \`localStorage\` and no access to the dashboard. Only call APIs that allow browser requests (CORS \`*\`); anything else fails silently.
- Size content to the box: the frame is exactly the component's inner area. Use \`height: 100%\`, \`overflow: auto\` for lists, and \`@media (max-height: …)\` to drop detail in short boxes. Component auto-fit does not scale anything inside a panel.
- Errors inside the panel are reported to \`check_dashboard\`, so check after writing one.

## Data sources that work from a browser, with no API key
- **Weather** — \`https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto\`. Weather codes are WMO numbers; map them to words/icons yourself.
- **Rough location** — \`https://get.geojs.io/v1/ip/geo.json\` (fields \`latitude\`, \`longitude\`, \`city\`). It follows the network connection, so a VPN moves it; let the user correct it.
- **Sports scores and fixtures** — \`https://site.api.espn.com/apis/site/v2/sports/<sport>/<league>/scoreboard\`, e.g. \`football/nfl\`, \`football/college-football\`, \`baseball/mlb\`, \`basketball/nba\`, \`basketball/wnba\`, \`hockey/nhl\`. Each event has \`status.type.state\` (\`pre\`, \`in\`, \`post\`), \`status.type.shortDetail\`, \`date\`, and \`competitions[0].competitors[]\` with \`team.abbreviation\`, \`score\` and \`homeAway\`.
- **News** — any RSS feed through the built-in \`feed\` component (it proxies via rss2json). Reliable ones: BBC \`https://feeds.bbci.co.uk/news/rss.xml\`, NYT \`https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml\`, The Verge \`https://www.theverge.com/rss/index.xml\`, ESPN \`https://www.espn.com/espn/rss/news\`.
- Prefer the built-in \`feed\` and \`api\` components over a custom panel when they can do the job — they are styled by the dashboard and need no code.

## Design tips
- Keep strong contrast between \`fg\` and \`bg\`, and between components and the page background.
- A few well-sized components beat many tiny ones. Give clocks and live values large font sizes.
- Match component styling to the page accent for a coherent look.
`;
}
