const express = require("express");
const path = require("node:path");
// Resolve .env relative to this file, not the terminal's working directory.
const envPath = path.join(__dirname, ".env");
const envResult = require("dotenv").config({ path: envPath });
if (envResult.error) console.warn(`Could not read ${envPath}: ${envResult.error.message}`);

const app = express();

const PORT = process.env.PORT || 8787;
const TOKEN = process.env.MATCHPLAY_TOKEN;
// One canonical upstream host for both discovery and the general API proxy.
const MATCHPLAY_API_BASE = "https://api.matchplay.events";
const DISCOVERY_USER_ID = (process.env.MATCHPLAY_USER_ID || "").trim();
const DISCOVERY_TOURNAMENT_ID = (process.env.MATCHPLAY_DISCOVERY_TOURNAMENT_ID || "").trim();

if (!TOKEN) {
  console.error("Missing MATCHPLAY_TOKEN. Add it to your .env file.");
  process.exit(1);
}

// This backend is a local API proxy, NOT a static-file server. In particular,
// never expose the project root (which can contain .env, source, and Git files).
app.disable("x-powered-by");
const HOST = "127.0.0.1";
const allowedOrigin = (origin) => {
  if (!origin) return true; // non-browser local clients, e.g. curl
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      /^\d+$/.test(url.port) && Number(url.port) >= 1 && Number(url.port) <= 65535 &&
      url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
};
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  // Protect against browser-based cross-origin reads and local DNS rebinding.
  const hostname = (req.headers.host || "").split(":")[0].toLowerCase();
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return res.status(403).json({ error: "Only local Host headers are accepted." });
  }
  const origin = req.get("Origin");
  if (!allowedOrigin(origin)) {
    return res.status(403).json({ error: "Only local browser origins are allowed." });
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Discovery is requested only when the launcher opens or the TD clicks Refresh.
// Cache briefly to avoid repeatedly querying a shared Match Play token.
const discoveryCache = { expires: 0, value: null };
const numeric = (value) => /^\d+$/.test(String(value || "").trim());
// Safe diagnostics: never return the token or its content.
app.get("/api/launcher/discovery/status", (_req, res) => res.json({
  envLoaded: !envResult.error,
  tokenPresent: Boolean(TOKEN),
  upstreamApiHost: MATCHPLAY_API_BASE,
  configuredUserId: numeric(DISCOVERY_USER_ID) ? DISCOVERY_USER_ID : null,
  configuredTournamentId: numeric(DISCOVERY_TOURNAMENT_ID) ? DISCOVERY_TOURNAMENT_ID : null,
  profileLookupNeeded: !numeric(DISCOVERY_USER_ID) && !numeric(DISCOVERY_TOURNAMENT_ID),
  note: "If configuredTournamentId is null, the active server has not read the expected .env setting."
}));
async function mpGet(path) {
  const response = await fetch(`${MATCHPLAY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    let upstreamMessage = "";
    try { upstreamMessage = JSON.parse(body)?.message || ""; } catch { /* Not JSON */ }
    throw new Error(`Match Play returned HTTP ${response.status} for ${path}${upstreamMessage ? `: ${upstreamMessage}` : ""}`);
  }
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(`Match Play returned ${contentType || "non-JSON content"} for ${path}, not JSON. Verify API host and /api path prefix.`);
  }
  try { return JSON.parse(body); }
  catch { throw new Error(`Match Play returned malformed JSON for ${path}`); }
}
function unwrap(payload) { return payload?.data ?? payload; }
function ownId(value) { return value?.userId ?? value?.id ?? null; }

app.get("/api/launcher/discovery", async (_req, res) => {
  try {
    if (Date.now() < discoveryCache.expires && discoveryCache.value) {
      return res.json(discoveryCache.value);
    }
    // Prefer the explicit organizer ID, then the seed tournament. Only use
    // the restricted profile endpoint if no configured identity is available.
    let userId = numeric(DISCOVERY_USER_ID) ? DISCOVERY_USER_ID : null;
    let organizerName = "";
    let identitySource = userId ? "configured user ID" : "";
    if (!userId && numeric(DISCOVERY_TOURNAMENT_ID)) {
      const seed = unwrap(await mpGet(`/api/tournaments/${DISCOVERY_TOURNAMENT_ID}`));
      userId = seed?.organizer?.userId ?? seed?.organizer?.id ?? seed?.owner?.userId ?? seed?.owner?.id
        ?? seed?.ownerId ?? seed?.organizerId ?? seed?.userId ?? null;
      organizerName = seed?.organizer?.name ?? seed?.owner?.name ?? "";
      identitySource = "configured tournament";
      if (!userId) throw new Error(`Tournament ${DISCOVERY_TOURNAMENT_ID} was retrieved, but its organizer ID was not present in the expected fields. Set MATCHPLAY_USER_ID explicitly in .env.`);
    }
    if (!userId) {
      try {
        const profile = unwrap(await mpGet("/api/users/profile"));
        userId = ownId(profile);
        organizerName = profile?.name || "";
        identitySource = "profile";
      } catch (err) {
        throw new Error(`${err.message}. Configure MATCHPLAY_USER_ID or MATCHPLAY_DISCOVERY_TOURNAMENT_ID in the project's .env. Check /api/launcher/discovery/status to confirm the running server loaded it.`);
      }
    }
    if (!userId) throw new Error("Unable to determine organizer user ID. Set MATCHPLAY_USER_ID in .env.");
    // Match Play supports owner filtering, but does not offer an 'active series
    // owned by token' endpoint. Derive series from the organizer's tournaments.
    // Restrict to the newest 200 to avoid deep pagination and rate-limit issues.
    const pages = [];
    for (let page = 1; page <= 2; page++) {
      const payload = await mpGet(`/api/tournaments?owner=${encodeURIComponent(userId)}&limit=100&page=${page}`);
      const batch = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      pages.push(...batch);
      if (batch.length < 100) break;
    }
    const now = Date.now();
    const maxFuture = now + 30 * 86400000;
    const eventStart = t => t.startLocal ?? t.startUtc ?? t.startAt ?? t.startsAt;
    const inDiscoveryWindow = t => {
      const start = eventStart(t);
      const date = start ? Date.parse(start) : NaN;
      // Unknown dates remain discoverable; manual IDs are always unrestricted.
      // Also prevent old tournaments left 'started' from filling the list.
      return !Number.isFinite(date) || (date >= now - 120 * 86400000 && date <= maxFuture);
    };
    const recent = pages.filter(inDiscoveryWindow);
    const tournaments = recent.filter(t => {
      const status = String(t.status || '').toLowerCase().replace(/_/g, '-');
      return ['planned', 'scheduled', 'not-started', 'created', 'ready', 'open', 'started', 'active', 'in-progress'].includes(status);
    });
    // Include series from the owner's full recent page, not only the filtered
    // tournament list: upcoming series can have no started tournaments yet.
    const seriesIds = [...new Set(recent.map(t => t.seriesId).filter(Boolean))].slice(0, 40);
    // Some series aren't attached to a listed tournament yet. Look only at the
    // first two pages of recent series, and include them *only* when the API
    // supplies matching ownership; don't claim unowned public series.
    try {
      for (let page = 1; page <= 2; page++) {
        const response = await mpGet(`/api/series?page=${page}`);
        const batch = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        for (const entry of batch) {
          const owner = entry.ownerId ?? entry.organizerId ?? entry.userId ?? entry.organizer?.userId ?? entry.organizer?.id;
          const id = entry.seriesId ?? entry.id;
          if (id && owner != null && String(owner) === String(userId) && inDiscoveryWindow(entry) && !seriesIds.some(x => String(x) === String(id))) seriesIds.push(id);
        }
        if (batch.length < 25) break;
      }
    } catch (err) {
      console.warn('Optional recent series lookup unavailable:', err.message);
    }
    // Only fetch series actually found on the user's tournaments.
    const series = (await Promise.all(seriesIds.slice(0, 40).map(async id => {
      try {
        const s = unwrap(await mpGet(`/api/series/${id}`));
        return { ...s, seriesId: s.seriesId ?? id };
      } catch { return { seriesId: id, name: `Series ${id}` }; }
    }))).filter(Boolean);
    const value = { organizer: { userId, name: organizerName, identitySource }, tournaments, series,
      note: 'Showing recent planned and active tournaments starting within the next 30 days. More distant events can be opened by entering an ID manually.' };
    discoveryCache.value = value;
    discoveryCache.expires = Date.now() + 60000;
    res.json(value);
  } catch (err) {
    console.error('Launcher discovery:', err.message);
    res.status(502).json({ error: err.message, hint: "Discovery reached the local backend but Match Play rejected an upstream request. Check the server terminal for its endpoint and status." });
  }
});

app.get("/api/*path", async (req, res) => {
  try {
    const rawPath = String(req.params.path || "");
    const segments = rawPath.split("/");
    if (segments.some((s) => s === "..")) {
      return res.status(400).json({ error: "Invalid path." });
    }

    const safePath = `/api/${segments.map(encodeURIComponent).join("/")}`;
    const upstreamUrl = new URL(safePath, MATCHPLAY_API_BASE);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) {
        for (const v of value) query.append(key, String(v));
      } else if (value != null) {
        query.append(key, String(value));
      }
    }
    upstreamUrl.search = query.toString();

    if (upstreamUrl.origin !== new URL(MATCHPLAY_API_BASE).origin) {
      return res.status(400).json({ error: "Invalid upstream target." });
    }

    console.log("Proxying:", upstreamUrl.toString());

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    res
      .status(response.status)
      .type(response.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send(String(err));
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Match Play proxy running on http://${HOST}:${PORT}`);
  console.log(`Discovery configuration: user ID ${numeric(DISCOVERY_USER_ID) ? "set" : "not set"}, tournament ID ${numeric(DISCOVERY_TOURNAMENT_ID) ? "set" : "not set"}; loaded .env: ${!envResult.error}`);
});