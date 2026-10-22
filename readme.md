# Super Abari Match Play Wallboard

A real-time tournament display system for Match Play Events designed for TVs, projectors, and stream displays.

Supports:

* Single Tournament Events
* League / Series Events
* Group Match Play
* Group Knockout / Strikes

The system provides a pre-tournament Check-In Screen and an in-tournament Wallboard Screen.

---

# Features

## Launcher

Available at `/` in the React application.

Allows the operator to configure:

### Event Type

* Single Tournament
* League / Series

### Tournament Type

* Group Match Play
* Group Knockout / Strikes

### IDs

* Tournament ID
* Series ID (League Mode only)

Values are stored in session storage and reused between page loads.

---

# Dev Tools (Ctrl+K)

Available from any screen.

Features:

* Toggle Mock/Test Mode
* Switch between Check-In and Wallboard pages
* Change Tournament Type
* Change Series/Tournament Mode
* Hide Completed Games
* Maintain Tournament Director list

### Tournament Director List

Enter one TD per line:

```
Kaylee Campbell
Bill Mason
Jamie Caton
```

Players matching the configured names receive a highlighted TD badge on the Current Games display.

This allows players to quickly identify which active games contain a Tournament Director.

---

# Mock Mode

A complete local testing mode is included.

When enabled:

* No Match Play API calls are made
* Local mock data is used
* API proxy is not required

Useful for:

* Layout testing
* Stream setup
* Development
* Venue testing without internet access

---

# Check-In Screen

Route:

```
/checkin
```

Used before tournament start.

---

## Shared Features

Displays:

* Event title
* Event start time
* Registration QR Code
* Super Abari logo
* Discord QR Code
* Embedded YouTube playlist
* Check-In Status panel

Tournament status is checked every 10 seconds.

When the tournament becomes active, the display automatically switches to:

```
/wallboard
```

---

## League / Series Mode

Uses:

```
/api/series/{id}/rsvps
```

for attendance tracking.

The right panel rotates every 60 seconds between:

* Series Standings
* Check-In Status

### Series Standings

Displays:

* Position
* Player Name
* Best 4 Results Total

Standings automatically scroll.

### Automatic Standings Suppression

If a series does not yet have standings data, the display remains on Check-In Status and does not rotate.

---

## Single Tournament Mode

Uses:

```
/api/tournaments/{id}/rsvps
```

for attendance.

The right panel remains on Check-In Status only.

---

## Check-In Categories

Tournament mode categorizes players as:

### ✓$ Checked In and Paid

Green

### ✓ Checked In Only

Blue

### □ Not Checked In / Not Paid

Gray

### $ Paid but Not Checked In

Orange

---

## Priority Check-In Mode

Once 15 or more players have checked in:

The Check-In display automatically switches to a priority layout.

### Not Checked In

Players still requiring check-in are displayed in a dedicated section at the top.

This section remains visible and prioritized to help staff identify missing players quickly.

### Checked In

Checked-in players move to a separate section below.

This section continues to auto-scroll independently.

---

## Check-In Summary

The summary section remains fixed at the top.

Displays:

* Total Registered
* Total Checked In
* Check-In Percentage
* Status Breakdown
* Progress Bar

---

# Wallboard Screen

Route:

```
/wallboard
```

Used once tournament play begins.

---

## Current Games

Displays:

* Machine Name
* Active Players
* Game Timer

Supports:

* 2-player games
* 3-player games
* 4-player games

Unused player positions are hidden automatically.

---

## Tournament Director Indicators

Players configured in the Dev Tools TD list receive a highlighted badge:

```
[TD] Kaylee Campbell
```

This allows players to identify available TDs quickly during tournament play.

---

## Completed Games

Completed games:

* Move to the bottom
* Remain visible (unless hidden)
* Receive green highlighting
* Receive a bright green machine-name outline

A Hide Completed Games toggle is available in Dev Tools.

---

## Match Play Results

For Group Match Play events:

Completed games display actual Match Play points pulled from Match Play API results.

Example:

```
Kaylee    4
Bill      2
Jamie     1
Chris     0
```

No hardcoded point values are used.

---

## Knockout Results

For Group Knockout / Strikes events:

Completed games display strike information.

Example:

```
Kaylee
Bill
Jamie    X
Chris    X
```

Strike displays are disabled in Match Play mode.

---

## Game Timers

Timers display:

```
MM:SS
```

and automatically switch to:

```
HH:MM:SS
```

after one hour.

### Timer Alerts

Timers turn red when:

* A game exceeds 30 minutes
* OR it is the final active game in the round

---

## Current Games Scrolling

A scroll toggle is available beside the Current Games font controls.

When enabled:

* Quickly scrolls to the bottom
* Pauses for 5 seconds
* Smoothly scrolls back to the top
* Pauses for 5 seconds
* Repeats continuously

Useful for large events with more active games than can fit on screen.

---

## Standings

### League / Series

Displays:

* Position
* Player Name
* Best 4 Results Total

Scores are displayed as whole numbers.

### Tournament

Uses Match Play standings directly.

### Knockout

Displays:

* Position
* Player Name
* Strike Count

Strike counts are shown as red X indicators.

Standings automatically:

* Pause at top
* Scroll
* Pause at bottom
* Repeat

Supports approximately 100 rows.

---

# Refresh Rates

## Every 10 Seconds

* Tournament status
* Current games
* Tournament standings

## Every 60 Seconds

* RSVP data
* Series standings

---

# Requirements

## Node.js 20+

Vite 8 requires Node.js 20 or newer.

Verify:

```bash
node --version
npm --version
```

---

# Installation

```bash
git clone https://github.com/kayleecamp42/league-matchplay-projector.git
cd league-matchplay-projector
npm install
```

---

# Configuration

Create a `.env` file:

```text
MATCHPLAY_TOKEN=YOUR_MATCHPLAY_API_TOKEN
PORT=8787
```

The token must belong to the Match Play account that owns the tournament or series.

Organizer access is required for RSVP and check-in endpoints.

---

# Running

The application requires two processes.

## Terminal 1 — API Proxy

```bash
node server.js
```

## Terminal 2 — React Development Server

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

# URLs

Examples:

```text
http://localhost:5173/

http://localhost:5173/checkin?mode=series&tournament=253855&series=5803&tournamentType=group-matchplay

http://localhost:5173/wallboard?mode=series&tournament=253855&series=5803&tournamentType=group-matchplay

http://localhost:5173/?mock=true
```

---

# Production Build

```bash
npm run build
```

Outputs:

```text
dist/
```

Update `server.js` to serve from `dist/` when deploying.

---

# Project Structure

```text
src/
├── components/
├── hooks/
├── mock/
├── pages/
│   ├── launcher/
│   ├── checkin/
│   └── wallboard/
├── api.js
├── utils.js
└── App.jsx
```

Shared UI components live in:

```text
src/components
```

Reusable hooks live in:

```text
src/hooks
```

Mock API functionality lives in:

```text
src/mock
```

---

# Security

Never commit:

```text
.env
node_modules/
dist/
*.log
```

---

# Future Ideas

* Finals bracket display
* Sponsor rotation
* Player photos
* Stream overlay mode
* TGP display
* Machine queue tracking
* Player callout system
* Multi-TV layouts
* Mobile spectator mode
* Multi-venue support
* Broadcast graphics package integration
