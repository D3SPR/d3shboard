# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**d3shboard** is a client-only dashboard builder (Vite + React 19 + TypeScript + Tailwind v4). People place components on a freeform canvas, style them, organise pages, add automations (time/data-based rules) and animations. There is no backend: all state lives in `localStorage`.

Most of what people put on a page comes from the **component library**: ready-made designs bound to **data variables** (weather, headlines, scores, the time). Writing custom HTML is still possible but is now the escape hatch, not the main path. `docs/component-pivot.md` is the proposal this was built from.

It started as a reverse-engineered rebuild of a Lovable app ("Canvas — Your Own Dashboard"). The original minified bundle is in git history (first commit) if behaviour ever needs to be compared.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run mcp        # AI agent bridge (MCP over HTTP) on http://127.0.0.1:7331/mcp
npm run typecheck  # app (tsc -b) + MCP server (tsc -p mcp)
npm run build      # typecheck + production build to dist/
npm run build:single  # one self-contained HTML file in dist-single/ (JS, CSS and favicon inlined) for static hosting
npm run build:bridge  # standalone bridge bundle in dist-bridge/ (runs on plain Node, no install)
```

`node mcp/server.ts --stdio` runs the same bridge for MCP clients that launch servers themselves. The MCP server runs as TypeScript directly via Node's built-in type stripping (Node 23.6+), with no build step.

There is no test suite or linter configured.

## Architecture

**State is one document** (`BoardDoc` in `src/lib/types.ts`) held in `App.tsx` with `useState` and saved to `localStorage` on every change. Everything else is derived from it.

- **Storage compatibility matters.** The key is `dashboard.board.v1` (kept from the original app) and `normalizeDoc` in `src/lib/board.ts` must keep accepting every format ever written: the flat v1 shape (`widgets` at top level), multi-panel v3 (no `animations`), v4 (no `sources`/`library`) and current v5. Imported backup files go through the same function. When adding fields, give them defaults in `normalizePanel` / `defaultStyle` rather than bumping behaviour for old saves.
- **"Panels" in code are "Pages" in the UI.** Data model names were kept for compatibility; user-facing copy was changed. Likewise the `md` breakpoint is shown as "Tablet", `lg` as "Computer".
- **A page is a scaled stage.** Each screen has a design size (`BREAKPOINTS`, phone 390×760, tablet 820×1000, computer 1440×820). `Canvas` renders a stage of exactly that size and scales it by one factor for both axes (`stageScale`), centred, so a dashboard fills a phone or a television without distorting and nothing is ever cut off for being slightly too low. Saved positions are stage units — **pointer deltas must be divided by the scale** when dragging, resizing or dropping.
- **Screens are data, not three fixed keys.** `doc.screens` holds them and people can add one for their current window (`addScreen` in `App.tsx`), which copies each widget's layout from the closest existing screen (`nearestLayout`). `BreakpointKey` is therefore any string; the three built-ins are always present so old saves keep working, and `screenFor` picks the largest screen that fits the window. Content and style are shared across screens; position/size/hidden are not.
- **Auto-fit** (`style.autoFit`, on for new widgets). The canvas renders `effectiveStyle(widget, rect)` rather than `widget.style`. With auto-fit on, `fontSize` and `padding` scale by `min(rect.w / defaultW, rect.h / defaultH)` from the type's size in `WIDGET_DEFAULTS`, and `align` is forced to center. Stored `fontSize`/`padding`/`align` are then ignored until auto-fit is turned off, at which point the calculated values are written back so nothing jumps. Widget content should size itself in `em` so it follows the card's font size, and Text/Feed centre vertically with `justify-content: safe center` when auto-fit is on. Saves without the field load with `autoFit: false` so existing dashboards don't change. Over the bridge, setting `fontSize`/`padding`/`align` turns auto-fit off unless `autoFit` is passed too.
- **Edit vs display mode** (`doc.mode`). Automations and animations only apply in display mode. `App.tsx` builds a `RenderBoard` by overlaying automation effects (accent, font, background, per-widget visibility, forced page) onto the active panel.

### Data sources and variables (`src/data/`)
`doc.sources` holds configured **data sources**, shared by the whole dashboard so one fetch feeds every component using it.

- A `SourceKind` (`src/data/sources/*.ts`, registered in `registry.ts`) declares its settings (`params`), a `group` for the Add dialog's Data tab, a refresh interval, typed `fields` and a `load(params)` that fetches. There are ~28 kinds across weather, markets, news, sports, space, personal and fun, exposing 550+ individually bindable variables. Fields carry a `label`, a `FieldType`, default formatting and an `example` used for library previews before real data arrives — keep examples realistic, including list fields.
- `useDataSources` (`store.ts`, provided through `DataContext` in `App.tsx`) fetches on each source's own schedule, keeps the last good values through a failed refresh, and seeds from a `localStorage` cache (`d3shboard.data.cache`) so a cold load paints real numbers. It also publishes a snapshot to `data/live.ts`, which is how the bridge and diagnostics read current values without being React components.
- `formatValue` (`format.ts`) turns a raw value into display text; a `Binding`'s `format` overrides the field's own.
- Everything must be key-free and CORS-friendly: there is no backend and no place to put a secret. **Check a new endpoint from the browser before building on it** — many well-known APIs (Yahoo Finance, Stooq, Reddit, the public CORS proxies) refuse browser requests outright. Live share prices are the one exception: `stocks` needs a free Twelve Data key for anything but AAPL, taken as a normal source setting and stored only in that browser.
- Lists (`type: "list"`) carry `of` item fields, and every field's `example` doubles as preview data — when a library card's slot isn't filled yet, `render.tsx` falls back to the kind's examples, so previews look real before anything is set up. Keep examples realistic when adding a source.

### Components (`src/components/`)
A component is a declarative tree (`CompNode`: `stack`, `text`, `icon`, `image`, `bar`, `divider`, `spacer`, `repeat`, `if`) rendered natively by `render.tsx` — **not** an iframe, so it inherits auto-fit, the page font, theme colours, animations and diagnostics.

- Sizes are tokens rendered in `em` and colours are roles (`text`, `muted`, `accent`, `positive`, `negative`), which is what makes auto-fit and themes work. Don't put raw pixel sizes or hex colours in a component definition.
- A `ComponentDef` (`library/*.ts`) declares `needs` (data source kinds), optional `params` and a `root` tree. Values inside it are literal strings, `{ bind, path }` (bind = a need key, or `@item` inside a `repeat`) or `{ param }`.
- A placed component is `widget.type === "component"` with `widget.component: ComponentInstance` (`defId`, `sources` slot→id map, `params`, and `tree` once the design has been edited, which detaches it from the library). `config.baseW/baseH` carry the reference size auto-fit scales from.
- **Some components are usable on the finished dashboard**, not just in the editor: the `field`, `stepper`, `checklist` and `button` nodes write straight back into that component's `params` through `ComponentActionsContext` (`components/interaction.ts`), so a note can be retyped, a goal counted, a box ticked or a source reloaded in display mode. Edit mode covers widgets with a transparent overlay for dragging, which is what keeps these inert while arranging. Updates that build on the old value **must** pass a function to `setParam` — two quick taps on a counter would otherwise both read the same rendered number.
- A `ComponentNeed` marked `optional` is never created automatically, which is how a component can work either from typed-in numbers or from live data (see `number.goal`, which switches on a `mode` setting).
- **Two kinds of design.** A `stack` tree arranges itself to fit any size (that's how the library ships). A `canvas` tree is freeform: `CanvasItem`s positioned as fractions of the component box, so they scale with it but don't reflow. `convertToCanvas` (`components/canvasEdit.ts`) turns the first into the second by measuring a hidden full-size render — which is why the designer keeps that hidden copy sized to the card's **content** area, padding excluded.
- The **designer** (`src/ui/ComponentMaker.tsx`) is the **only** editor for a component — its data sources' own settings (which league, which place, which feed), look, options, size, position and movement all live there, because splitting them across two dialogs meant people couldn't find things like the sports league. `WidgetEditor` now only serves the basic widget types. It deliberately mirrors the page canvas: a toolbar of things to add above, the card at its real shape with grid, snap-to-grid and corner handles, tools underneath, then per-piece settings and the whole component's look. Pieces are stored as fractions of the card but dragged and snapped in the card's own pixels. Per-piece `scale`, `tint` and `font` override what the component sets; leave them unset and the piece follows. `ensureSource` sets up a data source the moment a value is dropped in, so data never has to be arranged in advance.
- Saved designs live in `doc.library` (`SavedComponent`) and are placed by remapping their slots to sources of the same kinds.

### Themes (`src/themes/`)
A `Theme` sets accent, font, background and a `CardLook` together. Applying one patches the page and (unless turned off) every component's style. The per-component "Quick styles" in the Look tab stay separate — don't add a second list of card presets.

### Automations (`src/automations/engine.ts`)
`useAutomations` re-evaluates every 20s and refetches `dataValue` URLs every 60s. A rule is active when all its conditions pass; its actions merge into an `AutomationEffects` object. `activeIds` is exposed so animations can trigger on a rule switching on.

### Animations (`src/animations/`)
Rules are stored **per panel** (`panel.animations`), each with a `trigger`, `target` (`widgetId` + `part`) and `effect` (`preset` | `property` | `custom`), plus `timing`.

- The canvas marks DOM nodes with `data-widget-id`, `data-widget-card`, `data-widget-title`, `data-widget-content`; the engine finds targets by these attributes rather than React refs. Keep them when editing `Canvas.tsx`.
- Special target ids: `@trigger` (the component that fired the trigger) and `@all`.
- Presets and property changes run via the Web Animations API using individual `translate`/`scale`/`rotate` properties so they compose with the CSS idle animations (`.anim-*` in `index.css`, driven by `style.animation`).
- Custom effects: CSS is rewritten so `.target` → `[data-dx-run~="<ruleId>"]` and `.overlay` → `[data-dx-overlay="<ruleId>"]`; timing is exposed as `--dx-*` CSS variables; HTML is injected as an overlay on the widget wrapper; JS runs via `new Function(el, overlay, api)` **in the main document** (unlike the Custom code widget, which is sandboxed in an iframe). Imports warn when a backup contains custom animation JS/HTML (`docHasCustomCode`).
- `useAnimationEngine` wires triggers (click/hover via delegation on the canvas root, timers, `timeOfDay` polling, `d3sh:widget-data` window events emitted by the Feed/API widgets when their value changes, and automation activation edges). `runAnimation` is also used directly for Preview in the editor.
- `clonePanel` remaps widget ids inside animation rules when duplicating a page.

### AI agent bridge (`mcp/` + `src/bridge/`)
The dashboard only exists in the browser's `localStorage`, so agents can't edit it directly. Instead the flow is: MCP client → `mcp/server.ts` (HTTP `/mcp` or stdio) → WebSocket `/bridge` → the open tab → `runOperation` → `setDoc`.

- Component-era tools matter most: `list_components` / `add_component` (creates any data source it needs), `list_data_sources` / `add_data_source` / `update_data_source`, `list_variables` (what each source currently reads), `list_themes` / `apply_theme`. The guide pushes agents to these before custom HTML.
- **All editing logic runs in the page** (`src/bridge/operations.ts`): pure functions `(doc, method, params) → { doc, result, summary }` built on the same model helpers the UI uses. The server is a thin relay: zod schemas in `mcp/tools.ts` validate input, then it forwards `{ method, params }` and returns the page's result. Add a capability by adding a `BridgeMethod` in `protocol.ts`, a case in `runOperation`, and a tool in `tools.ts`.
- The public API uses friendly names ("pages", screens `phone`/`tablet`/`computer`, mode `editing`/`viewing`); `operations.ts` maps them to the internal `panels` / `sm|md|lg` / `edit|display`. `get_dashboard` with `raw: true` and `replace_dashboard` use the internal backup format.
- `useAgentBridge` (mounted in `App.tsx`, active in both modes) applies changes through a ref before React re-renders, so back-to-back calls see each other. It keeps an in-memory undo stack of agent changes (30) and an activity log shown in `AgentDialog`.
- **Security model:** the server binds `127.0.0.1` only; every HTTP request and WebSocket upgrade must have an allowed `Host` (blocks DNS rebinding); the page `Origin` must be localhost or explicitly allowed; the tab must send the pairing code from `mcp/.pairing-code` (gitignored, generated on first run, overridable with `D3SH_PAIRING_CODE`), with a lockout after 5 wrong attempts. One tab at a time: a newly connected tab replaces the previous one.
- **Hosted pages** (the app served from a real site rather than localhost) work through the same local bridge. `mcp/config.ts` resolves settings from flags, env and a remembered `mcp/bridge.json` (gitignored): `--allow-origin` / `D3SH_ALLOWED_ORIGINS` (exact or `https://*.example.com`), `--allow-host` / `D3SH_ALLOWED_HOSTS` (for reaching the bridge through a tunnel), `--port`, `--any-origin`, `--forget-origins`. Origins passed in are saved so later runs need no flags. A disallowed origin gets the WebSocket handshake **completed** and then a `rejected` message naming the flag to run — a silent connection failure is indistinguishable from "bridge not running". `/mcp` answers CORS preflights including `Access-Control-Allow-Private-Network` / `-Local-Network-Access`, which browsers require before a public page may reach a server on the user's machine.
- **Browser limits, not fixable server-side:** a page may only reach loopback if it is a secure context (https, or localhost). Plain http on a LAN address is blocked outright — `AgentDialog` detects this (`!window.isSecureContext` with a loopback bridge URL) and says so. Chrome additionally prompts for permission; Safari refuses entirely.
- **Standalone bridge for hosted users.** `npm run build:bridge` (esbuild) bundles the server and its dependencies into one `dist-bridge/d3shboard-bridge.mjs` that runs on plain Node 22+ with no install step; it is published next to the app (e.g. `d3tech.xyz/d3shboard-bridge.mjs`) and the Agent dialog tells hosted users to `curl` it and run it. Do not tell people to `npx github:...`: npm 12 ships `allow-git=none`, so git installs fail by default. `mcp/bin.mjs` remains as the package bin for checkouts and checks the Node version first.
- When running from a checkout, the pairing code and `bridge.json` sit in `mcp/`; the bundled build stores them in `~/.config/d3shboard` instead (`STATE_DIR` in `config.ts`, chosen by whether `mcp/tools.ts` sits beside the entry point).
- `mcp/guide.ts` (the `get_guide` tool) is generated from the real preset, property, font and widget-default lists, so it stays in sync. It therefore imports `src/` files at runtime, which means those files (and anything they import at runtime) must use explicit `.ts` extensions on non-type imports. Currently that's `src/lib/board.ts`, `src/brand.ts`, `src/widgets/defaults.ts`, `src/animations/presets.ts`, `src/animations/properties.ts`, `src/bridge/protocol.ts`, `src/themes/index.ts`, and the whole of `src/components/library/` and `src/data/` (registry, sources, `nodes.ts`, `lib/util.ts`).
- The guide includes a custom-panel gotchas section and a list of key-free, CORS-friendly data sources (Open-Meteo, geojs, ESPN scoreboards, RSS) — keep it current when those change.
- Port: `D3SH_BRIDGE_PORT` (default 7331). The app's bridge address is editable under Agent → Advanced.

### Templates (`src/templates/`)
`TEMPLATES` describes ready-made pages: a theme, optional named data sources, and specs that are either a library component (`component`, `settings`, `use`) or a basic widget type, each with all three screen layouts. `buildTemplate(template, existingSources, name?)` returns `{ panel, sources }` — it reuses a matching source instead of adding a second one, so applying two templates doesn't fetch the same feed twice. They are exposed three ways and must stay in sync: the Pages menu → "Start from a template", palette commands, and the bridge's `list_templates` / `apply_template`. Applying always **adds a page**, never replaces.

### Diagnostics (`src/bridge/diagnostics.ts`)
`check_dashboard` is the agent's only way to see what it built. Two layers:
- **Model checks** (any page): off-canvas, below-the-fold (the canvas doesn't scroll), overlaps, sub-minimum sizes, missing config (feed/api/image/embed), custom panels with no `color-scheme`, and fg/bg contrast composited over the page background. For library components it also reports unattached data slots, sources that failed to load and lists that are currently empty — these read live values from `data/live.ts`.
- **Live checks** (only the page currently on screen, found via `data-widget-id`): content taller than its box, feeds that failed or are still loading, live values showing the error dash, broken images, and errors thrown inside custom panels.

Custom panels can't be inspected from outside, so `WidgetBody`'s embed wrapper injects a reporter that posts `error`, `unhandledrejection` and `console.error` up to the page; `bridge/embedLog.ts` collects them (started in `main.tsx`) and diagnostics reads them per widget. Keep that reporter when editing the embed wrapper.

### Command palette (`src/commands/` + `src/ui/CommandPalette.tsx`)
Opened with Ctrl+K / ⌘K or Ctrl+Space (the listener is on `window` in the capture phase in `App.tsx`, so it works inside text fields). `buildCommands(ctx)` builds the whole command list from current state each time the palette opens, so commands are contextual: selected-component actions only exist while something is selected, and there's one "Go to page" per page.

- **When you add a user-facing action anywhere in the app, add a matching command** in `buildCommands.ts`, with `keywords` for synonyms. Actions that change variables inside dialogs (sliders, per-field settings) intentionally aren't commands; one-shot presets (fonts, accent swatches, background presets) are.
- `App.runCommand` closes any open dialog or menu, switches to edit mode unless the command sets `anyMode`, then runs the command on the next frame (so `confirm()` and newly opened popovers don't fight the closing palette).
- Commands with `prompt` ask for text in a second step (e.g. renaming a page).
- Toolbar menus are opened by setting `openMenu` state, which lives in `App` for this reason.
- Ranking: label prefix > word start > substring > all words found in label, group or keywords > letters in order. Commands for the selected component get a boost, recently used ones a small one; the last 5 are stored in `localStorage` under `d3shboard.recentCommands`.

### UI (`src/ui/`)
- `kit.tsx` holds shared primitives (`Field` with optional `help` tooltip, `Section`, `Disclosure`, `Segmented`, `Toggle`, `Slider`, `ColorField` with alpha, `Dialog`, `Popover`). `NumberField` is the only numeric control — a box you type in, with an optional `unit` suffix and **no minimum or maximum**. There are no sliders anywhere. Don't reintroduce a range: if a value needs converting for display (percentages, say), convert it at the call site so the number in the box is the number you'd type, and guard the *use* of a value that can't be zero (grid spacing divides) rather than stopping it being typed.
- **Adding anything happens in one place.** The toolbar's Add button opens `AddDialog`, whose two tabs are the component library (`LibraryPanel`, including a "Basics" section with "Build your own" and the raw widget types) and the data sources (`DataPanel`). **Data can only be added by putting it somewhere** — the Data tab configures what's in use and nothing else, and App drops any source no component references (after a short delay, so a source created for a value being dropped in survives the tick before it is bound). Both panels are plain content — the dialog owns the chrome — so keep them free of their own `Dialog` wrappers. The dialog hides itself while a basic is dragged onto the canvas. Popovers and tooltips portal to `document.body` and position from the anchor rect, so theme colours come from CSS variables (`--accent`, `--accent-ink`, `--chrome`) set on `document.documentElement` in `App.tsx`.
- Menus/dialogs are written for non-technical users: plain-language labels, a short intro line, `help` explanations on anything non-obvious, and ready-made presets/templates. Keep new settings consistent with that tone. Raw power-user values stay reachable behind a `Disclosure` (e.g. arbitrary CSS colours, unknown widget config keys in "Other settings").
- `WidgetEditor.tsx` has a hand-written form per basic widget type (components never reach it). A component's number setting only gets a slider when it declares both `min` and `max` — without a range it renders a plain number box, since a slider would otherwise silently cap it. It it also renders any config keys it doesn't know about so nothing becomes uneditable.

**Keep the surface small.** The toolbar is Add / Theme / Screen / Pages / More, and "Basics" deliberately excludes clock, note, headlines and live number because the library has better versions — two of everything is what made this confusing before. Interactive pieces render inert in previews (`inert(ctx)` in `render.tsx`), since a library card is itself a button and a button inside a button is invalid HTML.

Branding (name, tagline, default accent, export filename) lives in `src/brand.ts`; the logo is `Logo` in `src/ui/icons.tsx`, and the favicon is an inline SVG data URI in `index.html` (so the single-file build needs no extra files).

## Runtime network calls

Data sources and widgets fetch directly from the browser: `api.open-meteo.com` and `geocoding-api.open-meteo.com` (weather and the place search), `get.geojs.io` (rough location), `site.api.espn.com` (scores), `api.rss2json.com` (news feeds), arbitrary user JSON URLs (Live number, the "any data link" source, automation data conditions), `picsum.photos` (default picture), and Google Fonts from `index.html`. CORS failures surface as the widget's error/placeholder state.
