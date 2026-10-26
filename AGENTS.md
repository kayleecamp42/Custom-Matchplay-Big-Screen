# Instructions for contributors and AI coding assistants

Custom Matchplay Big Screen is a localhost-only, read-only display for Match Play tournaments, run by non-programmer tournament directors. Keep it simple and beginner-friendly.

**Before changing architecture, the API proxy, polling, scoring, or Finals layout, read [docs/ARCHITECTURE_AND_GUARDRAILS.md](docs/ARCHITECTURE_AND_GUARDRAILS.md).** It records intentional behavior and past regressions. Verify its claims against the current code, and update it when you change an intentional behavior.

## Critical invariants

- Backend binds to `127.0.0.1` only. Do not enable LAN/`0.0.0.0`, wildcard CORS, or non-local Host/Origin.
- `npm start` must keep starting both the Express proxy and Vite from one terminal.
- Match Play API upstream is exactly `https://api.matchplay.events/api/...` (host and `/api` prefix). `app.matchplay.events` is for web/QR links only.
- `MATCHPLAY_TOKEN` stays server-side in `.env`. Never expose it in frontend code, browser storage, logs, errors, tests, commits, or docs.
- Never serve the project root (no `express.static(__dirname)`).
- The API proxy is an allowlist in `proxyPolicy.js`. To support a new endpoint, add it there **and** add a positive test in `test/proxy.test.js`. Never forward raw `req.originalUrl`, never follow redirects with the token, never suppress a CodeQL alert instead of fixing it.
- Official Match Play standings `position` decides ranking and ties; strike counts only decide knockout completion.
- Preserve the Finals layout rules (current round only, vertically stacked groups, no whole-page scaling), event discovery and manual-ID fallback, the community QR fallback, the Settings gear/Ctrl+K, and assets centralized in `src/config.js` and `public/`.

## How to work

1. Read the relevant source first. State the scope and a short plan; prefer small diffs over rewrites.
2. Don't change unrelated code (no restyling or scoring rewrites during a security fix).
3. Run `npm test` and `npm run build` before proposing a change, and `npm audit` for dependency or security work. Add tests for new behavior, including negative cases for security changes.
4. Say which checks you could not run. Never claim live Match Play verification unless it was actually done.
5. Never commit `.env`, `node_modules`, `dist`, or screenshots showing private settings.

## Keep the README current

After **every** change, check whether [README.md](README.md) needs an update: setup steps, requirements, scripts and commands, `.env` settings, supported formats, user-visible behavior, or screenshots. Update it in the same pull request.

Do **not** put security or vulnerability fixes, advisories, or CodeQL details in the README. Describe them in the commit/PR description (and `docs/ARCHITECTURE_AND_GUARDRAILS.md` when they change design rules). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
