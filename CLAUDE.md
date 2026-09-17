# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**d3shboard** is a client-only dashboard builder (Vite + React 19 + TypeScript + Tailwind v4). People place components on a freeform canvas, style them, organise pages, add automations (time/data-based rules) and animations. There is no backend: all state lives in `localStorage`.

It started as a reverse-engineered rebuild of a Lovable app ("Canvas — Your Own Dashboard"). The original minified bundle is in git history (first commit) if behaviour ever needs to be compared.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run mcp        # AI agent bridge (MCP over HTTP) on http://127.0.0.1:7331/mcp
npm run typecheck  # app (tsc -b) + MCP server (tsc -p mcp)
npm run build      # typecheck + production build to dist/
```

`node mcp/server.ts --stdio` runs the same bridge for MCP clients that launch servers themselves. The MCP server runs as TypeScript directly via Node's built-in type stripping (Node 23.6+), with no build step.

There is no test suite or linter configured.

## Architecture

**State is one document** (`BoardDoc` in `src/lib/types.ts`) held in `App.tsx` with `useState` and saved to `localStorage` on every change. Everything else is derived from it.

- **Storage compatibility matters.** The key is `dashboard.board.v1` (kept from the original app) and `normalizeDoc` in `src/lib/board.ts` must keep accepting every format ever written: the flat v1 shape (`widgets` at top level), multi-panel v3 (no `animations`), and current v4. Imported backup files go through the same function. When adding fields, give them defaults in `normalizePanel` / `defaultStyle` rather than bumping behaviour for old saves.
- **"Panels" in code are "Pages" in the UI.** Data model names were kept for compatibility; user-facing copy was changed. Likewise the `md` breakpoint is shown as "Tablet", `lg` as "Computer".
- **Per-breakpoint layouts.** Each widget has `layouts.sm/md/lg` rects. Content and style are shared across breakpoints; position/size/hidden are not. In edit mode the breakpoint can be overridden from the toolbar; in view mode it follows window width (`breakpointFor`).
- **Edit vs display mode** (`doc.mode`). Automations and animations only apply in display mode. `App.tsx` builds a `RenderBoard` by overlaying automation effects (accent, font, background, per-widget visibility, forced page) onto the active panel.

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

- **All editing logic runs in the page** (`src/bridge/operations.ts`): pure functions `(doc, method, params) → { doc, result, summary }` built on the same model helpers the UI uses. The server is a thin relay: zod schemas in `mcp/tools.ts` validate input, then it forwards `{ method, params }` and returns the page's result. Add a capability by adding a `BridgeMethod` in `protocol.ts`, a case in `runOperation`, and a tool in `tools.ts`.
- The public API uses friendly names ("pages", screens `phone`/`tablet`/`computer`, mode `editing`/`viewing`); `operations.ts` maps them to the internal `panels` / `sm|md|lg` / `edit|display`. `get_dashboard` with `raw: true` and `replace_dashboard` use the internal backup format.
- `useAgentBridge` (mounted in `App.tsx`, active in both modes) applies changes through a ref before React re-renders, so back-to-back calls see each other. It keeps an in-memory undo stack of agent changes (30) and an activity log shown in `AgentDialog`.
- **Security model:** the server binds `127.0.0.1` only; every HTTP request and WebSocket upgrade must have a local `Host` (blocks DNS rebinding); browser `Origin`s must be localhost (or listed in `D3SH_ALLOWED_ORIGINS`); the tab must send the pairing code from `mcp/.pairing-code` (gitignored, generated on first run, overridable with `D3SH_PAIRING_CODE`), with a lockout after 5 wrong attempts. One tab at a time: a newly connected tab replaces the previous one.
- `mcp/guide.ts` (the `get_guide` tool) is generated from the real preset, property, font and widget-default lists, so it stays in sync. It therefore imports `src/` files at runtime, which means those files (and anything they import at runtime) must use explicit `.ts` extensions on non-type imports. Currently that's `src/lib/board.ts`, `src/brand.ts`, `src/widgets/defaults.ts`, `src/animations/presets.ts`, `src/animations/properties.ts` and `src/bridge/protocol.ts`.
- Port: `D3SH_BRIDGE_PORT` (default 7331). The app's bridge address is editable under Agent → Advanced.

### Command palette (`src/commands/` + `src/ui/CommandPalette.tsx`)
Opened with Ctrl+K / ⌘K or Ctrl+Space (the listener is on `window` in the capture phase in `App.tsx`, so it works inside text fields). `buildCommands(ctx)` builds the whole command list from current state each time the palette opens, so commands are contextual: selected-component actions only exist while something is selected, and there's one "Go to page" per page.

- **When you add a user-facing action anywhere in the app, add a matching command** in `buildCommands.ts`, with `keywords` for synonyms. Actions that change variables inside dialogs (sliders, per-field settings) intentionally aren't commands; one-shot presets (fonts, accent swatches, background presets) are.
- `App.runCommand` closes any open dialog or menu, switches to edit mode unless the command sets `anyMode`, then runs the command on the next frame (so `confirm()` and newly opened popovers don't fight the closing palette).
- Commands with `prompt` ask for text in a second step (e.g. renaming a page).
- Toolbar menus are opened by setting `openMenu` state, which lives in `App` for this reason.
- Ranking: label prefix > word start > substring > all words found in label, group or keywords > letters in order. Commands for the selected component get a boost, recently used ones a small one; the last 5 are stored in `localStorage` under `d3shboard.recentCommands`.

### UI (`src/ui/`)
- `kit.tsx` holds shared primitives (`Field` with optional `help` tooltip, `Section`, `Disclosure`, `Segmented`, `Toggle`, `Slider`, `ColorField` with alpha, `Dialog`, `Popover`). Popovers and tooltips portal to `document.body` and position from the anchor rect, so theme colours come from CSS variables (`--accent`, `--accent-ink`, `--chrome`) set on `document.documentElement` in `App.tsx`.
- Menus/dialogs are written for non-technical users: plain-language labels, a short intro line, `help` explanations on anything non-obvious, and ready-made presets/templates. Keep new settings consistent with that tone. Raw power-user values stay reachable behind a `Disclosure` (e.g. arbitrary CSS colours, unknown widget config keys in "Other settings").
- `WidgetEditor.tsx` has a hand-written form per widget type; it also renders any config keys it doesn't know about so nothing becomes uneditable.

Branding (name, tagline, default accent, export filename) lives in `src/brand.ts`; the logo is `Logo` in `src/ui/icons.tsx` and `public/favicon.svg`.

## Runtime network calls

Widgets fetch directly from the browser: `api.rss2json.com` (news feeds), arbitrary user JSON URLs (Live number, automation data conditions), `picsum.photos` (default picture), and Google Fonts from `index.html`. CORS failures surface as the widget's error/placeholder state.
