# Super Abari Match Play Wallboard — Codebase Context

This project was recently migrated from standalone HTML files to a React + Vite app. If you were working on `checkin.html` or `wallboard.html` before, those files no longer exist — all that logic now lives in `src/`.

---

## Running locally

Two terminals required:

```bash
# Terminal 1 — API proxy (Express, port 8787)
node server.js

# Terminal 2 — React dev server with hot reload (port 5173)
npm run dev
```

Open **http://localhost:5173**. Requires Node 20+.

`.env` must exist with `MATCHPLAY_TOKEN` set. Copy `.env.example` to get started.

---

## Project structure

```
server.js          Express API proxy — forwards /api/* to Match Play with auth token
src/
  App.jsx          Routes: / → Launcher, /checkin, /wallboard
  utils.js         Shared pure functions (formatting, score logic, session config helpers)
  styles.css       Shared design tokens and base styles
  hooks/           useStandingsScroll — the scroll animation logic used by both pages
  components/      Shared UI: PanelHeader, QrCard, StatusStrip, DevToolsModal, MockModeBanner
  mock/            Mock API (data.js + api.js) — activated by ?mock=true
  pages/
    launcher/      Setup form — operator enters IDs, picks mode/format, launches a page
    checkin/       Pre-tournament screen (check-in status, series standings, YouTube)
    wallboard/     Live tournament screen (games, timers, standings, WebSocket)
```

Each page directory contains the page component, its CSS, and a `components/` subfolder for anything only that page uses.

---

## Session config

The operator fills out the **Launcher** (`/`) which saves to `sessionStorage`:

| Key | Values |
|-----|--------|
| `mode` | `"tournament"` \| `"series"` |
| `tournament` | tournament ID string |
| `series` | series ID string |
| `tournamentType` | `"group-matchplay"` \| `"group-knockout"` |

Both `/checkin` and `/wallboard` read these values from `sessionStorage` on mount — no URL params needed. The launcher navigates with React Router (`navigate()`), not a full page reload.

---

## Dev tools (⌘K / Ctrl+K)

A dev panel is available on every page:

- **Test Mode** — activates mock API (`?mock=true`), no proxy or token needed
- **Check-In / Wallboard options** — toggle mode, format, and hide-completed directly
- **Navigation** — jump between Launcher, Check-In, and Wallboard

---

## Key concepts ported from the old HTML files

- `checkin.html` → `src/pages/checkin/`
- `wallboard.html` → `src/pages/wallboard/`
- `index.html` (launcher) → `src/pages/launcher/`
- Inline `<script>` logic → split into React components + `src/utils.js`
- All game/score/strike logic is in `src/utils.js` (`resultValueForPlayer`, `standingValue`, `isCompletedGame`, etc.)
- WebSocket connection lives in `Wallboard.jsx` inside a `useEffect`
- The standings scroll animation is a custom hook: `src/hooks/useStandingsScroll.js`
