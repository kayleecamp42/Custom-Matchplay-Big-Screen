const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.MATCHPLAY_TOKEN = "test-token-not-real";
const { buildUpstreamUrl } = require("../proxyPolicy");
const app = require("../server");

const upstreamCalls = [];
const okResponse = () => new Response('{"data":[]}', { status: 200, headers: { "content-type": "application/json" } });
let upstreamBehavior = okResponse;
global.fetch = async (url, options) => {
  upstreamCalls.push({ url: String(url), options });
  return upstreamBehavior();
};

let server;
test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});
test.after(() => server.close());
test.beforeEach(() => { upstreamCalls.length = 0; upstreamBehavior = okResponse; });

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: server.address().port, path, headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

const VALID = [
  "/api/tournaments?owner=45&limit=100&page=1",
  "/api/tournaments?series=9&status=started",
  "/api/tournaments/123?includePlayers=1&includeArenas=1&includeBanks=1&includeSeries=1&includeLocation=1&_ts=1700000000000",
  "/api/tournaments/123/games?round=activeOrLatest",
  "/api/tournaments/123/rounds",
  "/api/tournaments/123/standings",
  "/api/tournaments/123/rsvps",
  "/api/series/77?includeDetails=1",
  "/api/series/77/rsvps",
  "/api/series?page=1",
  "/api/users/profile",
];

for (const path of VALID) {
  test(`forwards allowed request: ${path.split("?")[0]}`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200);
    assert.equal(upstreamCalls.length, 1);
    assert.equal(upstreamCalls[0].url, `https://api.matchplay.events${path}`);
  });
}

const BLOCKED = [
  "/api/anything-else",
  "/api/tournaments/abc",
  "/api/tournaments/123/delete",
  "/api/tournaments/123/games/extra",
  "/api/tournaments/%2e%2e/users",
  "/api/tournaments/123/%2e%2e/%2e%2e/admin",
  "/api/tournaments/123%2F..%2Fadmin",
  "/api/tournaments/123?evil=1",
  "/api/tournaments/123?limit=1&limit=2",
  "/api/tournaments/123?round=../x",
  "/api/series/77/standings",
  "/api/users/other",
];

for (const path of BLOCKED) {
  test(`rejects unsupported request without contacting Match Play: ${path}`, async () => {
    const res = await get(path);
    assert.equal(res.status, 400);
    assert.equal(upstreamCalls.length, 0);
  });
}

test("sends the token only to the fixed Match Play host and refuses redirects", async () => {
  await get("/api/tournaments/123");
  const { url, options } = upstreamCalls[0];
  assert.equal(new URL(url).origin, "https://api.matchplay.events");
  assert.equal(options.redirect, "error");
  assert.match(options.headers.Authorization, /^Bearer /);
});

test("upstream failure returns a generic error without leaking details or the token", async () => {
  upstreamBehavior = () => { throw new TypeError("redirect mode is set to error: https://evil.example/?t=test-token-not-real"); };
  const res = await get("/api/tournaments/123");
  assert.equal(res.status, 502);
  assert.ok(!res.body.includes("test-token-not-real"));
  assert.ok(!res.body.includes("evil.example"));
});

test("passes through upstream status codes", async () => {
  upstreamBehavior = () => new Response('{"message":"nope"}', { status: 404, headers: { "content-type": "application/json" } });
  assert.equal((await get("/api/tournaments/999")).status, 404);
});

test("rejects non-local Host and foreign Origin headers", async () => {
  assert.equal((await get("/api/tournaments/123", { Host: "evil.example" })).status, 403);
  assert.equal((await get("/api/tournaments/123", { Origin: "https://evil.example" })).status, 403);
  assert.equal(upstreamCalls.length, 0);
});

test("allows the local Vite origin", async () => {
  assert.equal((await get("/api/tournaments/123", { Origin: "http://localhost:5173" })).status, 200);
});

test("does not serve project files such as .env", async () => {
  for (const path of ["/.env", "/server.js", "/package.json"]) {
    assert.equal((await get(path)).status, 404);
  }
});

test("local discovery status route stays local and never returns the token", async () => {
  const res = await get("/api/launcher/discovery/status");
  assert.equal(res.status, 200);
  assert.ok(!res.body.includes("test-token-not-real"));
  assert.equal(upstreamCalls.length, 0);
});

test("buildUpstreamUrl rejects non-array input", () => {
  assert.equal(buildUpstreamUrl("tournaments/123", {}), null);
  assert.equal(buildUpstreamUrl(undefined, {}), null);
});
