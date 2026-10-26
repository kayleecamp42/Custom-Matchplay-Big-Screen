# Custom Matchplay Big Screen — Project History & Design Guardrails

**Context for contributors and AI coding assistants**  
**Last reviewed:** October 26, 2026  
**Repository:** https://github.com/kayleecamp42/Custom-Matchplay-Big-Screen  
**Original author:** Kaylee Campbell  
**Status:** Free, MIT-licensed public beta; limited volunteer maintenance, contributions welcome.

> **IMPORTANT — Historical context, not a replacement for source inspection.** This document summarizes how the project evolved, design choices that were deliberately made, and bugs that took multiple iterations to fix. Before making changes, inspect the current code and tests. Where this document and the code differ, point out the discrepancy rather than silently overriding working behavior, and update this document when you change an intentional behavior.

## 1. What this application is—and is not

Custom Matchplay Big Screen began as a projection/wallboard tool for Super Abari pinball tournaments and leagues, then became a customizable application intended for other Match Play tournament directors. It is **independent of and not officially supported by Match Play**.

A tournament director runs the application on the laptop directly connected to a projector or TV. It fetches Match Play tournament data through a **locally running, token-authenticated Express proxy**, and displays read-only tournament information in a React browser interface. Its purpose is **presentation**, not editing tournament results or performing tournament administration via API.

It should remain straightforward for nonprogrammers: follow the README, install Node.js and npm, create `.env`, run `npm install` once, then `npm start` to open the display. No mandatory Electron launcher, global installation, second terminal, database, cloud account, or hosted service.

The author has publicly stated that significant beta bugs may be considered for a short initial period, but **ongoing maintenance, custom support, and future feature work are not promised**. Favor low-complexity changes that others can understand and contribute to.

## 2. High-level architecture and launch behavior

- **Frontend:** Vite + React, with React Router routes `/` (Launcher), `/checkin`, `/wallboard`, and `/finals`.
- **Backend:** Node.js + Express in `server.js`; listens on **`127.0.0.1`**, normally port **8787**.
- **Browser:** Vite dev server, normally **`http://localhost:5173`**. It can select another port; the console output is authoritative.
- **Single command:** `npm start` runs `node scripts/start.js`, which starts the Express proxy and Vite as child processes. Shutting down should stop both processes. `npm run dev` and `npm run server` remain useful for contributors.
- **Credentials:** Backend reads `MATCHPLAY_TOKEN` from the local `.env`. Optional discovery fallbacks are `MATCHPLAY_USER_ID` and `MATCHPLAY_DISCOVERY_TOURNAMENT_ID`. These are configuration values, not additional credentials. Never put the token in `src/config.js`, a URL, README, logs, an error response, or source control.
- **API routing that MUST be preserved:** Match Play requests go to **`https://api.matchplay.events/api/...`**. Both the `api.matchplay.events` **hostname** and `/api` **path prefix** are required. `https://app.matchplay.events` is the **website** used for tournament and QR destination links, not the API host.
- **WebSocket:** The regular Wallboard uses Match Play's separate WebSocket service for live tournament update events. It also polls to recover from missed events. Do not casually replace, disable, or expose this to new network clients.
- **Frontend static assets:** Venue and championship images are in `public/`, referenced from `src/config.js` as `/filename.ext`. Do not restore hardcoded Super Abari root-level assets.
- **User preferences:** Some display settings and TD name overrides use browser `localStorage`; session selection (mode, IDs, division options) uses `sessionStorage`. Do not put the backend API token there.

**Important security boundary:** The current architecture is intended to work **only on the host laptop**. Optional LAN/smart-TV viewing has been discussed but deliberately deferred. Do not enable `0.0.0.0`, broad CORS, arbitrary host access, or remote API access to “fix” a local development problem.

## 3. Supported modes: preserve all of them

### Launcher and event discovery (`src/pages/launcher/Launcher.jsx`, `src/eventEligibility.mjs`, `server.js`)

The launcher shows eligible events associated with the configured organizer, while always retaining **manual numeric ID entry** as a fallback. There are three modes:

1. **Single Tournament:** Group Match Play or Group Knockout.
2. **League / Series:** Choose a series and a supported Group Match Play or Group Knockout tournament within that series.
3. **League Finals:** Match Play **Group Bracket** (also described as group-elimination finals), with **one division or two independent A/B division tournament IDs**.

Match Play's machine-readable finals format may be **`group-bracket`**, not `group-elimination`. Match Play events may be **`planned`** before they start; those must remain eligible for discovery and launching. Unsupported events can appear with a short reason, but cannot be selected. Manual entry bypasses the discovery search horizon, **not** the format eligibility validation.

Automatic discovery intentionally limits results to upcoming events (approximately **30 days ahead**), includes currently active events and unknown-date events, uses limited pagination, and caches discovery briefly. Some older/unlinked series may be absent: this is why manual IDs are essential. A direct series lookup is used to find series tournaments instead of assuming the same organizer owns every event.

**History of discovery regressions:** Early implementations failed with HTTP 404, HTTP 403, and HTML/JSON parsing errors because the API hostname and prefix were changed separately and incorrectly. Correct: **`https://api.matchplay.events/api/...`**. Incorrect: `app.matchplay.events/api/...` **or** `api.matchplay.events/tournaments` (missing `/api`). Profile discovery (`/api/users/profile`) may be unavailable; explicit organizer ID or a known organizer tournament remains supported. Do **not** reintroduce a mandatory profile lookup when either fallback is configured.

### Live Tournament Wallboard (`src/pages/wallboard/Wallboard.jsx`)

- Displays current games, machine assignments, player names, a venue/community/registration panel, and official standings; includes tournament/league variations, timers, scrolling options, font controls, and TD badges.
- Supports **Group Match Play** and **Group Knockout**.
- **Match Play official `position` is authoritative for standings**, especially Group Knockout. Do **not** invent final placements by sorting strike totals. Players eliminated in the same knockout round can share a place.
- Highlight by **actual official placement**: 1st gold, 2nd silver, 3rd bronze, 4th purple. Two people tied for 3rd are **both bronze** and no purple is shown when no player is officially 4th. Avoid coloring a huge active knockout field gold just because everyone temporarily has `position: 1`.
- Strike counts (`strikeCount`) are useful for displaying strikes and for determining **whether a knockout is finished**, **not** for recalculating official rank.
- Keep meaningful last-good state across temporary network failures.

### Check-In (`src/pages/checkin/Checkin.jsx`)

- Tournament/series RSVP and check-in displays, series standings, alternating panels, responsive fonts and scrolling, registration QR, community QR, and optional YouTube playlist.
- Series mode can auto-switch to Wallboard when the relevant tournament starts.
- Some existing standings logic is specialized for league display (including best-result summary). Preserve it rather than replacing it with generic standings math during an unrelated security patch.

### Finals (`src/pages/finals/Finals.jsx` and `Finals.css`)

This display had extensive testing and many hard-won adjustments. **Treat the JSX/CSS as regression-sensitive.**

- One or two divisions. Two-division mode uses **independent A/B tournament IDs**; single division takes the available screen width.
- Show **only the current round**. Quarterfinals show four groups, semifinals two, championship one. **Do not combine rounds on screen.**
- For single-division quarterfinals, **keep the four groups stacked vertically**, sized to fit. The owner explicitly rejected switching to a 2×2 grid.
- For two divisions, four vertically stacked groups must remain visible **above the bottom status bar**. Avoid blanket `transform: scale(...)`, oversized rows, unreadably tiny fonts, incorrect `overflow: hidden`, or arbitrary `min-height` rules. Several earlier “fit” patches broke the layout despite looking reasonable in CSS.
- Groups typically show a **three-game bank**, player positions (P1–P4), **whole-number** points, and totals; allow missing machine assignments (`Pending`/`Not assigned`) and variable name/machine length.
- Match Play additional tiebreaker games have been represented by `set === 9999`. Show a prominent **pink tiebreaker column/card outline**, but **leave nonparticipants' cells blank**. The pink outline must follow the entire actual group card, without pushing the last group off-screen.
- After regular bank games are complete, show **ADVANCED** (green) and **ELIMINATED** (red) only when certain, even with unfinished tiebreakers where other positions are mathematically decided.
- In the final round, show secured **1ST/2ND/3RD/4TH PLACE** as gold/silver/bronze/purple; leave unresolved ties unlabeled until their tiebreaker completes.
- When the final round closes and **official top-four standings successfully arrive** with no unresolved tiebreaker, replace the regular view with final-round scoreboard plus championship placement cards and remaining official standings. Don't require the whole tournament to be manually marked closed.
- In two-division results, **align A and B final-standings headings** even when final scoreboards have different heights.
- Configurable winner text: A typically **CHAMPION**; B default **17TH PLACE** with a cash/gift-card icon. Championship artwork is replaceable.
- TD badges must work in scoreboards **and** final standings.

## 4. Polling and completion rules (avoid API overuse and early freezes)

These timings reflect observed/previous implementation; **check current constants before editing**:

| Screen | Intended requests / behavior |
| --- | --- |
| Launcher | Fetch discovery when opened/refreshed, not constantly; brief backend cache |
| Check-In | Tournament-start status about every **10 s**; event/RSVP/series data about every **60 s** |
| Wallboard | Games and standings about every **30 s**; tournament/round completion check about every **60 s**; extra requests from WebSocket events |
| Finals | Per active division: tournament, games, rounds, standings about every **15 s**; both active divisions therefore generate more calls |

**Regular wallboard final freeze** (`src/tournamentCompletion.mjs` + Wallboard):

- A round must be **closed** and usable **official final standings and completed games** must have arrived.
- **Group Knockout:** read the event's `knockoutStrikeCount`; when exactly **one** player has fewer strikes than the limit after a closed round, the tournament is over. Unknown strike values must **not** be silently treated as zero.
- **Fixed-round Group Match Play:** `tournament.duration` is the **configured number of rounds** (in this format), not elapsed minutes. Freeze when the intended final round closes with final data present.
- **Open-ended/time-based Group Match Play:** **do not infer completion** from approximate clock time; continue polling unless a reliable completion signal is present.
- Tournament status can remain `started` after the last round closes. Don't make a manually closed tournament status the only completion signal.
- After verified completion, **close WebSocket and stop polling**, keeping the last successful result until browser reload. A failed or partial API fetch must not freeze prematurely.

**Finals freeze:** A/B divisions poll and freeze **independently**; one can finish while the other stays live. Stop polling a division only after official completed Finals results are renderable. Do not drop the cached display because of a transient request failure. Browser reload intentionally starts a fresh session.

## 5. Configurable branding, QR codes and settings

- Central settings are in `src/config.js`: generic venue/app/league/finals title, logo path, community URL/label, optional YouTube playlist, TD defaults, Finals graphics and winner labels.
- Assets live in `public/` (`venue-logo.svg`, `championship-trophy.svg`, etc.). This is an app for other TDs: **avoid hardcoding venue-specific content into components**.
- The **community QR must never silently vanish when unconfigured**. `getCommunityUrl()` falls back to a public GitHub README section explaining how to configure Discord/Facebook/community links. Multiple earlier patches accidentally bypassed that helper and rendered empty QR cards.
- QR images currently use an external generator (`api.qrserver.com`), which requires network access. Match Play event/registration URLs point to `https://app.matchplay.events/...` for people scanning with phones. A QR to `localhost` is **not reachable from a viewer's phone**.
- A sample YouTube playlist is intentionally supplied in `src/config.js`; it remains editable or removable by TDs.
- A **visible gear-only Settings button in the bottom information bar** opens the existing configuration modal; **Ctrl+K** also works. The panel must be accessible on small laptop screens, scrollable with a close button, and use clear **gold selection** highlighting. Toggle knobs should fill their oval tracks proportionally.
- TD names can come from defaults or browser-local overrides, and updates should propagate to views without modifying Match Play data.
- `open-display.html` is an optional browser shortcut: it checks whether the local app is running and shows `npm start` instructions if not. It **does not itself start Node**.

## 6. Security baseline already chosen; do not undo it

A focused hardening pass was completed prior to the beta:

- `server.js` **must not use** `express.static(__dirname)` to expose the whole project. `.env`, `.git`, local files and source must not become web-accessible.
- Express should bind to **`127.0.0.1`**, not all network interfaces.
- Reject non-local Host headers and limit browser CORS to local origins; **wildcard CORS is not appropriate** for a token-backed API proxy. Note that **CORS is not authentication**, and local-only host binding is a separate protection.
- Preserve working browser connections from the locally hosted Vite app to the proxy on port 8787 (these are different origins). Don't “fix” security by removing all CORS and breaking the UI.
- Do not print the API token or leak local `.env` paths/content via diagnostics; prevent unintended static file serving. A diagnostic endpoint may report **presence**, not value, of an organizer configuration or token.
- All Match Play access uses a **server-side Bearer token**. Treat that token as sensitive even though the browser only needs display data.
- The frontend's display preferences/TD names are **not** API credentials.
- The intended deployment is **localhost-only**. LAN/smart-TV **read-only** viewer mode is a potential future community contribution, but it needs a deliberate threat model, limited display-data endpoints, separate admin privileges, and firewall guidance.

### API proxy allowlist (SSRF protection)

CodeQL flagged the original generic proxy as a possible server-side request forgery. It is now restricted by `proxyPolicy.js` and covered by `npm test` (`test/proxy.test.js`). Never go back to forwarding the raw request URL, as in this **old pattern**:

```js
app.get('/api/*path', async (req, res) => {
  const url = MATCHPLAY_API_BASE + req.originalUrl;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  // ...
});
```

**Current behavior and rules for changing it.** The fixed upstream hostname and loopback listening reduce exposure but do **not** justify an unrestricted token-authenticated proxy. The proxy must:

1. Define **explicitly permitted, read-only Match Play endpoints** actually required by Launcher, Check-In, Wallboard, Finals, and discovery. Avoid proxying arbitrary paths simply because the host is fixed.
2. Validate all dynamic route segments (numeric tournament/series IDs where appropriate), reject encoded traversal/double-encoding tricks, and deliberately allow legitimate query parameters (`round=activeOrLatest`, `includePlayers`, `includeArenas`, `includeBanks`, `includeDetails`, `series`, `owner`, `status`, `limit`, `page`, cache-busting parameters if present).
3. Construct the destination from the **constant, correct** base `https://api.matchplay.events/api` and validated path/query. Don't accept arbitrary host/scheme from user input.
4. **Do not forward the Bearer token across redirects.** Use `redirect: 'error'` (or otherwise safely handle redirects) and fail closed on unexpected upstream destinations.
5. Continue to support **GET** endpoints and the exact frontend response shapes, query parameters, and normal HTTP error handling. Keep the UI functioning after the change.
6. Include positive and negative security tests. In particular, prove valid tournament/series/standings/games/rounds/RSVP/discovery requests still work, while traversal, unsupported endpoints, non-local Host/Origin, and redirect attempts are rejected.
7. Rerun CodeQL and inspect the *reason* for any remaining alert. Do not suppress a warning merely to obtain a green badge.

### Dependency advisories

Keep dependencies patched. `proxy-addr` was updated to 2.0.8 (a transitive Express dependency; the app does not enable `trust proxy`). Run `npm audit` before releases and review the effects before using `npm audit fix --force`.

## 7. API endpoints and compatibility checklist for the proxy

Inspect actual code for the complete list. The following routes have been observed in examined source snapshots:

| Purpose | Local route pattern | Important behavior |
| --- | --- | --- |
| Discovery | `GET /api/launcher/discovery` | Local aggregate route; organizer token/profile or fallback; cached |
| Discovery diagnostics | `GET /api/launcher/discovery/status` | Safe metadata only, **never token value** |
| Organizer profile (upstream) | `GET /api/users/profile` | Optional when fallback configured; may be restricted |
| Tournament list | `GET /api/tournaments?...` | Filters: `owner`, `series`, `status`, paging/limit |
| Tournament details | `GET /api/tournaments/:id?...` | Players, arenas, banks and tournament metadata flags |
| Games | `GET /api/tournaments/:id/games?round=activeOrLatest` | Round details and tiebreakers |
| Rounds | `GET /api/tournaments/:id/rounds` | Closing the last round is crucial |
| Official standings | `GET /api/tournaments/:id/standings` | **Authoritative positions/ties** |
| Tournament RSVPs | `GET /api/tournaments/:id/rsvps` | Check-in |
| Series list/details | `GET /api/series?...`, `GET /api/series/:id?includeDetails=1` | Discovery and series standings |
| Series RSVPs | `GET /api/series/:id/rsvps` | Series Check-In |

The browser often uses `http://localhost:8787/api/...`; the server forwards valid API paths to `https://api.matchplay.events/api/...`. **Keep the `/api` segment once, exactly once.** Some calls include extra cache-busting query parameters. Don't assume the HTTP status code or JSON envelope is identical across endpoints; existing UI uses `payload.data ?? payload` to accommodate response shapes.

## 8. Testing checklist for security, dependency, or proxy changes

Automated first: `npm test` (proxy allowlist, traversal, redirect, Host/Origin, no static file exposure) and `npm run build`. Then run `npm audit`. The manual checks below cover what automation cannot (live Match Play data and visual layout).

After the proposed change:

1. **Clean startup:** `npm install` (if dependencies changed), then `npm start`. Confirm both backend and frontend start with one command.
2. **Backend boundary:** `http://localhost:8787/.env` must **not** serve env data; invalid Host and foreign Origin must be refused. Confirm Vite → Express local requests still work.
3. **Discovery:** Launcher loads organizer's planned/active supported events; respects 30-day automatic window; unsupported formats have reasons; manual tournament and series IDs still function. Test fallback `.env` settings without relying on `/api/users/profile`.
4. **Single Tournament Group Match Play:** Start a 2-round fixed-format test; verify updates, official standings, final-round closure, and successful polling freeze. Open-ended match play must **not** freeze on a guessed clock time.
5. **Single Tournament Group Knockout:** Verify strike counts, tied eliminations using official `position`, gold/silver/bronze/purple **based on actual place**, and completion only when the last closed round leaves one player under the strike limit.
6. **Series / Check-In:** Verify registrations, check-in lists, series standings, community and registration QR, optional playlist, and auto-transition to Wallboard when event starts.
7. **Finals single division:** Group Bracket works; quarterfinals = four **vertical** groups, only current round, readable at small laptop resolution; semifinal/final progression, pink tiebreakers, results and polling freeze.
8. **Finals two divisions:** Independent A/B refresh/freeze, all four groups visible **including the bottom group and footer**, pink border aligned, no microscopic text or oversized rows. Test ~1366×768 and 1920×1080, including long player/machine names.
9. **Final standings:** Only resolve mathematically certain labels and completed tiebreakers; no premature results. Confirm official results and tied placements preserved. A/B results headings align.
10. **Settings and assets:** Gear in footer, Ctrl+K, responsive modal, TD badges, local settings, generic logo/assets from `public/`, community QR GitHub fallback, `open-display.html`.
11. **Security negatives:** Invalid IDs, traversal/encoded-path attempts, unsupported upstream routes, malformed parameters, untrusted redirects, and foreign Host/Origin must fail without leaking a Bearer token.
12. **Regression/CI:** `npm run build`, new tests, `npm audit`, CodeQL. Don't publish a tag until the actual release commit passes checks.

For high-risk changes, preserve a rollback point with Git rather than force-pushing release tags.

## 9. Working instructions for contributors and AI assistants

See [`AGENTS.md`](../AGENTS.md) for the short, enforceable version. Key points: read the relevant source first, keep diffs small, never leak secrets, and check whether the README needs updating.

## 10. Historical milestone summary

- **Original Super Abari tool:** Real-time tournament games/standings, league check-in, separate Match Play API proxy and Vite frontend, QR display and TD-specific presentation needs.
- **Super Abari Finals development:** Group Bracket quarter/semifinal/final rounds, independent A/B divisions, pink tiebreaker spotlight, mathematically secured advancement/placements, championship standings, and freeze after official results. Many iterations refined readability and viewport constraints.
- **October 2026 public fork:** Separate **Custom Matchplay Big Screen** repository, generic venue assets, centralized config, placeholder community QR linked to public GitHub README, default editable YouTube playlist, single-command startup, optional HTML desktop shortcut.
- **Accessibility and usability:** Visible settings gear + Ctrl+K, small-screen-friendly modal, gold selected options, proportional toggles, placement-based colors, manual event selection and discovery.
- **Discovery and completion corrections:** Planned events, Group Bracket identifier, 30-day horizon, owner and seed-tournament fallback, `api.matchplay.events/api` routing, Group Match Play/Knockout completion rules, independent Finals freeze.
- **Public beta preparation:** Public-oriented README, Windows prerequisites, screenshots, GitHub Issue templates, optional PayPal sponsorship, MIT license (Kaylee Campbell), security audit, loopback-only backend hardening.
- **Security hardening:** Loopback-only backend, local Host/Origin checks, no static file serving, `proxy-addr` update, and an allowlisted, redirect-refusing API proxy with automated tests (`npm test`).

---

**Bottom line:** This is a volunteer-built, localhost-only **display** application with unusually subtle tournament rules and previously fragile layout constraints. Keep changes small, preserve the user experience, event eligibility, official standings semantics, finals rules and API routing, and test every supported mode before calling a change complete.
