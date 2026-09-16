# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is a static mirror of the production build of **Canvas — Your Own Dashboard**, a Lovable-built single-page app (originally hosted at `snap-and-play-desk.lovable.app`). It is a drag-and-drop personal dashboard: users place widgets (clock, text/note, image, news feed, API value, web page embed, custom HTML/JS embed) on a freeform canvas, with support for multiple panels and time-based automations. State is saved to the browser's `localStorage` — there is no backend, no accounts, and no server-side persistence.

There is **no original source code** here — only the final built/minified assets served by the live site:

- `index.html` — entry point (Lovable's "Edit with Lovable" badge and analytics beacon have been stripped out)
- `assets/index-COzUSGuz.js` — main JS bundle (React + app shell + widget framework)
- `assets/routes-eSFc1sUC.js` — route/widget-registry bundle (TanStack Router), imports from `index-*.js`
- `assets/styles-dPw_xJBv.css` — compiled Tailwind CSS v4 output
- `favicon.ico`

Both JS bundles are minified production output with no sourcemaps. There is no `package.json`, no build tooling, and no readable component source — this repo cannot be meaningfully edited at the component/source level. Treat it as a runnable snapshot, not an editable codebase. If real source-level changes are needed, they must be made against the actual Lovable project (or by reimplementing from scratch), not by patching these bundles.

## Running it

No build step — just serve the directory statically and open it in a browser:

```bash
python3 -m http.server 4173
```

or

```bash
npx serve -l 4173 .
```

Then open `http://localhost:4173`. A `.claude/launch.json` is already configured to run the `npx serve` variant via the `run` skill / preview tooling.

## Runtime dependencies

The app is otherwise fully client-side/offline, but a few widgets call public third-party APIs directly from the browser at runtime (no proxy/backend involved):

- `feeds.bbci.co.uk` via `api.rss2json.com` — News feed widget
- `api.coindesk.com` — crypto price widget
- `picsum.photos` — placeholder images
- `fonts.googleapis.com` / `fonts.gstatic.com` — Space Grotesk, DM Sans, JetBrains Mono, Playfair Display, Bebas Neue

These will fail silently/gracefully offline; the rest of the UI (clock, notes, canvas editing, panels) works with no network access.
