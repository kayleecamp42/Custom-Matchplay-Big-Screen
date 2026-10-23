# Custom Matchplay Big Screen

A customizable browser-based big-screen display for tournaments and leagues using the [Match Play Events](https://matchplay.events/) API. This is an independent community project, not an official Match Play application.

## Requirements

- **Node.js 22.12 or newer** (recommended: current Node.js LTS), which includes `npm`. Vite 8 requires Node.js 20.19+ or 22.12+; using current LTS is simplest. Check with `node --version` and `npm --version`.
- **Git** (optional if downloading a ZIP instead of cloning).
- An internet connection for live Match Play data.
- A **Match Play API token** with access to the events you want to display.
- A modern browser such as Chrome, Edge, or Firefox.

## Install (Windows PowerShell)

1. Install Node.js from https://nodejs.org/ and (if using Git) Git from https://git-scm.com/. Close and reopen PowerShell afterward.
2. Clone the repository and open the folder:

   ```powershell
   git clone https://github.com/kayleecamp42/custom-matchplay-big-screen.git
   cd custom-matchplay-big-screen
   ```

   Or download the repository ZIP, extract it, and open PowerShell in the extracted folder.
3. **Required:** Install dependencies before your first launch (and again after dependency changes):

   ```powershell
   npm install
   ```

4. Create your private environment file from the template:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   Replace the placeholder in `.env` with your Match Play API token:

   ```dotenv
   MATCHPLAY_TOKEN=your_actual_token_here
   PORT=8787
   ```

   Never commit or share `.env`. The included `.gitignore` excludes it.

## Customize your venue (single configuration file)

Edit **`src/config.js`** before starting. This is the central place for venue-specific display settings:

| Setting | What it controls |
| --- | --- |
| `venueName` | Venue name shown at the top of Finals |
| `appTitle`, `leagueTitle`, `finalsTitle` | Launcher, league/check-in, and finals titles |
| `logoUrl` | Logo image used by wallboard and check-in |
| `communityUrl`, `communityLabel` | Community QR code across all views; blank URL links to public GitHub setup instructions |
| `playlistId` | YouTube playlist shown on check-in (empty string hides video) |
| `directors` | Initial TD player-name badges (case insensitive, exact names) |
| `finals.*` | Championship artwork, A/B winner labels, and B winner icon |

**All local assets live in `public/`** at the project root. Do not put logos or championship images beside `src/` or in the project root. Every display mode reads its local image URLs from `src/config.js`:

| Asset setting | Default file in `public/` | Used by |
| --- | --- | --- |
| `logoUrl` | `venue-logo.svg` | Tournament wallboard and league/check-in |
| `finals.headerImageUrl` | `championship-trophy.svg` | Finals header |
| `finals.championImageUrl` | `championship-trophy.svg` | A-division winner card |

The included logo is a generic **VENUE NAME** placeholder; the trophy is generic championship artwork. Replace either file with your own or add another image to `public/` and update its URL in `src/config.js` (for example `logoUrl: "/my-club-logo.png"` for `public/my-club-logo.png`). The URL should **start with `/` and omit `public`** because Vite serves that directory from the site root. SVG, PNG, JPEG, and WebP files work. Restart or refresh the browser to see changes; if the browser has cached an image, hard-refresh with Ctrl+Shift+R.

**Not image files:** tournament and community QR images are generated dynamically from their URLs; the B-division cash emoji is text configured by `winnerBIcon`. These are not missing static assets. An empty `communityUrl` keeps the QR card visible and points it to this repository’s GitHub README; an empty playlist field hides the video. No Super Abari logo or championship belt file is required for this generic build.

If upgrading from an older Super Abari copy, obsolete `super-abari-logo.png` (project root) and `public/championship-belt.png` / `public/venue-logo.png` may remain on disk; the updated app no longer references them. You can delete those old assets after verifying your custom settings don't use them.

**Default community QR:** When `communityUrl` is blank, the QR code links to the [Configure your community QR code](#configure-your-community-qr-code) section of this GitHub README. This works from phones on any network as long as this repository is **public** and GitHub is reachable. While the repository is private, scanning guests will encounter a sign-in or access error. Set a real Discord, Facebook, or other community link before running an event, or publish the repository before relying on its fallback QR. The local `public/community-setup.html` from earlier builds is no longer used as the fallback.

### Configure your community QR code

This QR code is a placeholder. Your tournament director should replace it with a link to a community gathering place, such as a Discord server, Facebook group, tournament website, or public event page.

1. Open `src/config.js` in your copy of **Custom Matchplay Big Screen**.
2. Find `communityUrl` and `communityLabel`.
3. Change these to your actual community URL and a short label, for example:

```js
communityUrl: "https://discord.gg/your-invite",
communityLabel: "Join Our Community",
```

4. Save the file, restart `npm start`, and refresh the display. Scan the updated QR code with a phone to verify it opens the right community page.

If you are seeing this page after scanning a big-screen display, ask the tournament director for a link to their local pinball community. This default QR code does not automatically join you to any group.

**TD badges:** The existing Ctrl+K Developer Tools TD list still works. If you've previously saved a TD list in the browser, it overrides the `directors` defaults in `src/config.js` for that browser. To use the file's defaults instead, clear the locally stored list in Developer Tools (or clear that site's `td-player-names` localStorage key). Display preferences and tournament IDs are still managed by the existing browser UI and session storage.

**Security:** Put the API token **only in `.env`**, not in `src/config.js`, which is bundled into browser-visible JavaScript.

**Not yet configurable:** Layout, refresh rates, scoring, and bracket/advancement logic remain unchanged to preserve established behavior. A future pass can expose those separately.

## Launch (every time)

From the project directory, run **one command**:

```powershell
npm start
```

This starts **both** the Express API proxy and the React/Vite display. Open the local address printed by Vite, normally **http://localhost:5173**. Use the launcher's event ID fields to choose your tournament or league. Keep the terminal open while the display is in use; press **Ctrl+C** to stop.

### Optional desktop shortcut (Windows)

You can make a desktop shortcut to **`open-display.html`** in the project root. After starting the app with `npm start`, double-clicking this HTML file opens the wallboard at `http://localhost:5173/`. If the local web server isn't running, it shows instructions to run `npm start` (or `npm install` first on a fresh checkout) and a **Try Again** button, rather than just showing a browser connection error.

To create the shortcut: right-click `open-display.html` in File Explorer, choose **Show more options → Send to → Desktop (create shortcut)** on Windows 11 (menu wording varies). The shortcut only opens the browser; **it cannot start Node.js for you**. Leave your `npm start` terminal open.

The shortcut assumes Vite runs on port **5173**. If that port is occupied, Vite may select a different port; use the URL printed in your terminal. Some browser security settings may block a local HTML file checking a local web server; in that case use the **Open display manually** link while the app is running.

> **Important:** This is a local development-style runtime, not yet a packaged production server. The Vite frontend and API proxy still run as separate processes, but `npm start` manages both for you. Live data requires the Match Play API and an internet connection.

## macOS / Linux

Install a supported Node.js version and optionally Git. Follow the same clone and `npm install` steps, then create `.env` with `cp .env.example .env` and edit it. Run `npm start` and open the printed local URL.

## Running on a TV

Connect a computer to the TV or projector and open the display URL in a browser on that computer. Full-screen mode is usually **F11** on Windows. This starter command binds the frontend to localhost for safety; viewing it from another device on your network will require a deliberate networking configuration change.

## What the application displays

- **Tournament wallboard:** active games, standings, and tournament information.
- **League / series check-in:** registrations and series standings.
- **League finals:** A/B division scoreboards, advancement, tiebreakers, and championship results.
- **Developer tools:** in the existing app, use **Ctrl+K** for mock mode and TD configuration.

Default settings use a generic venue name, logo placeholder, and trophy. Customize everything in `src/config.js` and `public/`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node` or `npm` not recognized | Install Node.js and reopen the terminal. |
| Missing `MATCHPLAY_TOKEN` | Check that `.env` exists next to `server.js` and contains the token. |
| `Cannot find module` or missing Vite | Run `npm install` from the repository folder. |
| Browser can't open the display | Check the URL printed by Vite and leave the terminal running. |
| API requests fail | Check your token, internet access, and whether the API proxy started. |
| Port 8787 already in use | Stop the old proxy process; the Vite proxy expects port 8787 by default. |
| Port 5173 already in use | Vite may choose another port; use the URL printed in the terminal. |

## Updating from GitHub

From the project directory, after saving any local changes:

```powershell
git pull
npm install
```

Then restart with `npm start`. Avoid storing personal settings directly in tracked source files; `.env` is intentionally ignored by Git.

## For contributors

- `npm start` starts the proxy and frontend together.
- `npm run dev` starts **only Vite** (useful if the API proxy is already running).
- `npm run server` starts **only the API proxy**.
- `npm run build` creates a frontend build in `dist/`; the current `npm start` command does not serve that build.

## Security

Treat the Match Play API token as a secret. Keep `.env` private. The local server is intended for trusted machines and networks; do not expose the API proxy directly to the public internet without additional security controls.

## Acknowledgment

Match Play and its API are provided by their respective owners. This community project is not affiliated with or endorsed by Match Play.

### Community QR card missing or blank?

All display modes use `getCommunityUrl()` in `src/config.js`. With an empty `communityUrl`, the QR must remain visible and point to the public GitHub README instructions. If an older update left the community card empty, install the community QR render fix and restart `npm start`. The QR image is fetched from an external QR image service, so internet access is needed for it to display; check your connection or content blockers if the card remains blank.


## Live updates and API request frequency

The Tournament / League Wallboard freezes the last successful standings and games snapshot and stops scheduled polling and WebSocket updates **once completion is confirmed**, until the browser is refreshed. Rules are format-specific:

- **Group knockout or basic knockout:** A round must be closed, and exactly one entrant in the official standings must have fewer strikes than `knockoutStrikeCount`. The standings endpoint supplies `strikeCount`; ranks remain the API's official `position` values. If strike data is incomplete, updates continue.
- **Group / head-to-head match play with a fixed number of rounds:** A round must be closed, and the number of created rounds must reach the tournament's `duration` setting (which Match Play defines as a **round count**, not minutes).
- **Open-ended / time-based match play:** Continue polling, since a scheduled end time cannot reliably tell when the TD has called time.
- **Manually completed tournament:** A completed tournament status and closed latest round are also sufficient.

In all cases, the app waits for successfully loaded official placements and completed latest games before freezing. If an API request fails, polling continues. Each open tab freezes independently.

Approximate scheduled request rates **per open display tab** (not counting WebSocket-triggered requests, retries, or other clients):

| View | Polling | Approximate requests |
| --- | --- | --- |
| Tournament / League wallboard | Games + standings every 30 seconds; tournament details + rounds + standings every 60 seconds for completion detection | **7 API requests/minute** |
| Tournament check-in | Tournament details + RSVPs every 60 seconds; tournament status every 10 seconds | **8 requests/minute** |
| League / series check-in | Series details + series RSVPs every 60 seconds; configured tournament status every 10 seconds | **Up to 8 requests/minute** |
| League Finals | Tournament, games, rounds, and standings every 15 seconds **per active division** | **16 requests/minute** with A and B active; 8 when only one remains active |
| Launcher | No scheduled polling | **0** |

Wallboard WebSocket events can trigger additional calls: round changes fetch games and standings; game changes fetch standings; player/arena changes reload details, games, and standings. Multiple open browser tabs multiply the load. Both Finals divisions stop independently when final results are confirmed; check-in continues polling until the user navigates away.

The wallboard completion check requires official standings containing placements, a successful latest games snapshot with no unfinished games, and a closed latest round. Completion-check calls fetch tournament details and rounds every 60 seconds, plus standings to evaluate knockout strikes. A final games call is made only when a completion candidate is detected. An API error leaves the last good display visible and polling continues so final standings are not lost.

**Single-tournament community QR:** This view also uses the shared `getCommunityUrl()` fallback from `src/config.js`, so the card points to the GitHub README when `communityUrl` is blank. The repository must be public for guests to access it.
