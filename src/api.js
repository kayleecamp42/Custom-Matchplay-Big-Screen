import { mockApiGet } from "./mock/api.js";

export function isMockMode() {
  return new URLSearchParams(window.location.search).get("mock") === "true";
}

export function createApiGet(baseUrl, apiToken = null) {
  return async function apiGet(path, params = {}) {
    if (isMockMode()) return mockApiGet(path, params);

    const url = new URL(baseUrl + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });

    const headers = { Accept: "application/json" };
    if (apiToken && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    const res = await fetch(url, { headers });
    const text = await res.text();
    if (!res.ok) { console.warn("API error", res.status, text); return null; }
    try { return JSON.parse(text); } catch { console.warn("API non-JSON response", text.slice(0, 200)); return null; }
  };
}
