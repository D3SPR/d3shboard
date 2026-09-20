# Pivot proposal: data variables, component libraries, and a component maker

**Status:** proposal, nothing built yet.
**Goal:** move d3shboard from "a canvas where advanced users write HTML and wire up APIs" to "a canvas where anyone assembles components from a library and binds them to ready-made data variables" — without taking away anything that works today.

---

## 1. The problem with today's model

Everything interesting in d3shboard currently requires code:

| Want | Today |
| --- | --- |
| Weather card | Custom code panel: write HTML, call Open-Meteo, map WMO codes, handle CORS, remember `color-scheme: dark` |
| Live score | Same, plus knowing the ESPN scoreboard JSON shape |
| Anything with two values in it | Same — the `api` widget shows exactly one value |

The `embed` widget is also a sandboxed iframe, which means it opts out of everything good in the app: auto-fit doesn't scale its contents, the page font doesn't reach it, the theme doesn't reach it, animations can't target anything inside it, and diagnostics can only see it through an injected error reporter.

Three consequences: users who don't code get clock, note, picture, one headline list and one number. Agents building through the bridge spend most of their effort writing fragile HTML (the A/B test made this obvious). And the nicest features of the app can't reach the most useful content on the screen.

## 2. The shape of the fix

Three layers, built in this order, because each one depends on the one before it:

```
   Data variables  ──►  Component format  ──►  Libraries + Component maker
   (where values     (how a component is      (what people actually
    come from)        described and drawn)     browse, drop and edit)
```

1. **Data variables** — a registry of data sources, each exposing typed fields (`weather.temp`, `news.items[]`, `sports.live[0].home.score`). Fetching, refreshing, caching and formatting happen once, centrally.
2. **Component format** — a small declarative tree (stack / text / icon / image / bar / repeat / if) with fields bound into it, rendered natively in React. No iframes.
3. **Libraries and the maker** — a browsable library of components, themes and card styles, and a GUI editor that produces the same format the library ships.

The key property: the library, the templates, the component maker and the agent bridge all produce and consume **one format**. Nothing has a private representation.

---

## 3. Layer 1 — data variables

### Model

```ts
type FieldType = "text" | "number" | "time" | "icon" | "image" | "list";

type FieldDef = {
  key: string;                 // "temp", "items", "live"
  label: string;               // "Temperature"
  type: FieldType;
  unit?: string;               // "°", "mph"
  format?: FormatDef;          // default formatting
  of?: FieldDef[];             // for type "list": the fields of each item
  example: unknown;            // used for previews before data arrives
};

type SourceKind = {
  kind: string;                // "weather"
  label: string;               // "Weather"
  description: string;
  icon: IconName;
  params: ParamDef[];          // what the user fills in (location, league, feed URL…)
  refreshSec: number;
  fields: FieldDef[];
  fetch(params, ctx): Promise<Record<string, unknown>>;
};
```

A user's dashboard holds **instances**:

```ts
type DataSource = { id: string; kind: string; name: string; params: Record<string, string>; };
// doc.sources: DataSource[]  (dashboard-level, shared by every page)
```

Dashboard-level, not per page, so five components using weather cause one fetch. A runtime store (React context) holds `{ status, value, fetchedAt, error }` per source; last-known values are cached in `localStorage` under a separate key so a cold load paints real numbers instantly instead of dashes.

### Bindings

```ts
type Binding = { source: string; path: string; format?: FormatDef };
// path: "temp", "items.0.title", "daily[].high" inside a repeat
```

Structured bindings for element slots; a token form (`{{weather.temp}}`) inside free text. Both go through one resolver, so there is one set of rules for missing data, loading and errors.

Formatting lives with the binding, defaulting from the field: number precision and unit, date/time patterns, relative time ("in 2 h", "4 min ago"), text truncation, upper/lower case. This is why users won't need code for "show the temperature rounded with a degree sign".

### Sources for v1

All key-free and browser-callable, all already proven in this repo:

| Kind | Backing | Fields (sketch) |
| --- | --- | --- |
| `time` | none (local clock) | `now`, `hour`, `date`, `weekday`, `greeting`, custom patterns |
| `location` | get.geojs.io, or typed by the user | `city`, `region`, `lat`, `lon` — feeds weather/sports defaults |
| `weather` | Open-Meteo | `temp`, `feelsLike`, `condition`, `icon`, `high`, `low`, `humidity`, `wind`, `sunrise`, `sunset`, `hourly[]`, `daily[]` |
| `news` | RSS via rss2json | `items[]` → `title`, `source`, `time`, `link`, `image` |
| `sports` | ESPN scoreboard | `live[]`, `upcoming[]`, `final[]` → teams, scores, `status`, `startsAt`; optional favourite team |
| `json` | any URL + path | the escape hatch — what the `api` widget does today, promoted to a source |

Later, same pattern, no new architecture: air quality and UV (Open-Meteo), sunrise/moon phase, crypto and FX (CoinGecko / exchangerate.host), holidays, a second RSS as "podcast/blog", ICS calendar URLs (CORS permitting).

### UI

A new **Data** menu: "Add data", a card per configured source with its live values shown next to each field name, and a Fix/Configure state when a fetch fails. This is also the browser the component maker reuses.

---

## 4. Layer 2 — the component format

Deliberately small. It's a layout language, not CSS:

```ts
type CompNode =
  | { kind: "stack"; dir: "row" | "col"; gap; align; justify; wrap?; grow?; pad?; bg?; radius?; children: CompNode[] }
  | { kind: "text"; content: Binding | string; size: SizeToken; weight?; color?: ColorRole; case?; lines? }
  | { kind: "icon"; icon: Binding | IconName; size: SizeToken; color?: ColorRole }
  | { kind: "image"; src: Binding | string; fit; radius?; aspect? }
  | { kind: "bar"; value: Binding; max: Binding | number; color?: ColorRole }
  | { kind: "spark"; values: Binding }
  | { kind: "divider" }
  | { kind: "repeat"; list: Binding; limit: number; gap; item: CompNode }
  | { kind: "if"; when: BindingTest; then: CompNode; else?: CompNode };
```

Two decisions worth calling out:

- **Tokens, not raw values.** `size` is a scale token (`xs`…`3xl`) rendered in `em`, `color` is a role (`text`, `muted`, `accent`, `positive`, `negative`). This makes **auto-fit work for free** — the card's font size already scales with the box, and everything inside is relative to it — and it makes themes able to restyle every component at once. Raw overrides stay available behind a disclosure, same as elsewhere in the app.
- **`repeat` and `if` are in the format.** Headlines, forecast days and score lists are the whole point, and "hide the LIVE badge unless the game is live" is what makes a component look designed rather than generic.

A component definition:

```ts
type ComponentDef = {
  id: string; name: string; description: string; icon: IconName;
  category: "Time" | "Weather" | "News" | "Sports" | "Numbers" | "Text & decor";
  defaultSize: { w: number; h: number };
  requires: string[];      // source kinds; adding the component offers to create/reuse them
  params?: ParamDef[];     // instance knobs: "show feels like", "how many headlines"
  root: CompNode;
};
```

Instances are a new widget type, so nothing existing changes:

```ts
{ type: "component", config: { defId: "weather.today", params: {...} } }
```

**Fork on edit:** while untouched, an instance points at the library definition and picks up improvements. "Edit design" copies the tree into the instance (`config.tree`) and detaches it. One rule, easy to explain.

### What this buys immediately

Auto-fit, theme fonts, theme colours, animations targeting named parts inside a component, real diagnostics (unbound variables, unconfigured sources, overflow, contrast — all checkable statically), and components that are ~40 lines of JSON instead of ~200 lines of escaped HTML.

---

## 5. Layer 3 — libraries and the maker

### Component library

Replaces the seven-item Add menu with a browser: categories down the side, cards with **live previews using the user's real data**, search, and "My components". Today's `clock`/`text`/`image`/`feed`/`api` stay as Basics and `iframe`/`embed` move to Advanced; nothing is removed.

Target for v1: roughly 24 components — e.g. Weather now / Hourly strip / 5-day / Sunrise-sunset; Big clock / Clock + date / World clocks / Countdown; Headlines list / Single top story / Ticker; Live scores / Next game / League table row / Team card; Big number / Number + sparkline / Number + goal bar; Greeting / Quote / Divider / Label.

### Theme and style libraries

Formalise what's currently ad-hoc per page:

```ts
type Theme = { id; name; accent; fontFamily; headingFont?; background: Background; roles: Record<ColorRole, string>; card: CardStyle };
type CardStyle = { bg; border; borderWidth; radius; shadow; blur; pad };  // "Glass", "Solid", "Outline", "None"
```

Theme applies to a page or the whole dashboard; card style applies per component or as the page default. 12–20 curated themes, all previewable.

### The component maker

One dialog, three panes:

- **Left — tree:** the element outline, with add / reorder / nest / delete.
- **Middle — preview:** the component at its real size, with real data, resizable to test auto-fit.
- **Right — inspector:** the selected element's content (binding picker), size, weight, colour role, spacing.
- **Bottom-left — variable browser:** every field of every configured source, searchable, with its current value. Drag a variable onto the preview to add a bound text node, or onto an existing node to bind it.

Saved to "My components" in `localStorage`, exportable with the board backup. Starting points: blank, duplicate a library component, or "make one from this component I already placed".

---

## 6. Knock-on work (each small, each valuable)

- **Bridge:** new tools `list_components`, `add_component`, `list_variables`, `add_data_source`, `set_binding`. The guide loses most of its custom-HTML gotchas section and gains a component and variable index generated from the real registries — the same trick `mcp/guide.ts` already uses. This is the fix for the "agent with no context builds something terrible" result.
- **Diagnostics:** static checks for unbound variables, sources that need configuring, list components with `limit` larger than fits, and contrast per colour role.
- **Templates:** rebuilt on library components; `src/templates/panels.ts` and its escaping hazard get deleted.
- **Command palette:** add-component and apply-theme commands generated from the libraries.
- **Storage:** `BoardDoc` v5 adds `sources` and `library`; `normalizeDoc` fills defaults, so v1/v3/v4 saves keep loading exactly as they do now.

---

## 7. Phases

| Phase | Ships | Visible change |
| --- | --- | --- |
| 1 | Source registry, runtime store, formatters, 6 sources, Data menu | A new menu; existing dashboards untouched |
| 2 | `component` widget type, renderer, ~24 library components, library browser | The pivot becomes real for users |
| 3 | Theme + card style libraries | Dashboards stop looking hand-rolled |
| 4 | Component maker + variable browser + My components | The headline feature |
| 5 | Bridge tools, diagnostics, templates, palette | Agents get the same power |

Phases 1–2 are the bulk of the work. Each phase is independently shippable and none of them breaks an existing save.

---

## 8. Decisions I need from you

1. **Backend or not.** No server means the variable library can only ever cover public, CORS-friendly, key-free data: weather, news, sports, crypto, holidays, time. Personal data (calendar, email, fitness, home automation, anything with an API key) needs either a small proxy or an "advanced: paste your key" escape hatch that exposes the key to the browser. My recommendation: stay client-only for now, design `SourceKind.fetch` so a proxy can be slotted in later without touching components.
2. **Library size vs depth for v1.** ~24 solid components, or fewer with more parameters each? I'd go 24 — browsing is the selling point.
3. **Do old widget types stay in the Add menu?** I'd move `iframe` and `embed` under "Advanced" and leave the rest as "Basics".
4. **Is the freeform canvas staying?** I'm assuming yes — it's the app's identity. Components lay themselves out inside their own box only.
5. **Where does the maker save?** Board document (travels with a backup) vs a separate "my library" key (survives clearing a board). I'd do both: live in the board, with an explicit "save to my library".

---

## 9. What I'd start on Monday

Phase 1, in this order: `src/data/types.ts` (field, source, binding, format types) → `src/data/sources/*.ts` (time, location, weather, news, sports, json) → `src/data/store.ts` (fetch, refresh, cache, subscribe) → `src/data/format.ts` → `src/ui/DataDialog.tsx`. Then prove it by rebuilding the current weather and sports template panels as bound components in phase 2 and deleting their HTML.
