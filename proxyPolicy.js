// Decides which Match Play API requests the local proxy may forward.
// Only read-only endpoints the display actually uses are allowed.
const MATCHPLAY_API_BASE = "https://api.matchplay.events";

const ID = /^\d{1,12}$/;
const TOURNAMENT_SUBRESOURCES = new Set(["games", "rounds", "standings", "rsvps"]);
const ALLOWED_QUERY_KEYS = new Set([
  "round", "includePlayers", "includeArenas", "includeBanks", "includeSeries",
  "includeLocation", "includeDetails", "series", "owner", "status", "limit", "page", "_ts",
]);
const QUERY_VALUE = /^[A-Za-z0-9_.,-]{1,64}$/;

function isAllowedPath(segments) {
  const [root, id, sub] = segments;
  if (segments.length === 2 && root === "users" && id === "profile") return true;
  if (root !== "tournaments" && root !== "series") return false;
  if (segments.length === 1) return true;
  if (!ID.test(id)) return false;
  if (segments.length === 2) return true;
  if (segments.length !== 3) return false;
  return root === "tournaments" ? TOURNAMENT_SUBRESOURCES.has(sub) : sub === "rsvps";
}

// segments: route wildcard parts after /api (Express 5 gives an array).
// query: parsed query object. Returns a URL, or null when the request is not allowed.
function buildUpstreamUrl(segments, query = {}) {
  if (!Array.isArray(segments) || !isAllowedPath(segments)) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!ALLOWED_QUERY_KEYS.has(key) || typeof value !== "string" || !QUERY_VALUE.test(value)) return null;
    params.set(key, value);
  }

  const url = new URL(`/api/${segments.join("/")}`, MATCHPLAY_API_BASE);
  url.search = params.toString();
  if (url.origin !== MATCHPLAY_API_BASE) return null;
  return url;
}

module.exports = { MATCHPLAY_API_BASE, buildUpstreamUrl };
