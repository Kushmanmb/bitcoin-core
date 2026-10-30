// Pure helpers (no DOM) so they can be unit-tested with node:test.

export const DEFAULT_CONFIG = Object.freeze({
  apiBase: "https://mempool.space/api",
  refreshSeconds: 60,
});

/** Validate an API base URL: must be https (or http on localhost), no credentials. */
export function validateEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Endpoint is not a valid URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("Endpoint must use https");
  }
  if (url.username || url.password) {
    throw new Error("Endpoint must not contain credentials");
  }
  return url.href.replace(/\/+$/, "");
}

/** Classify a search string as txid, block hash, height, address, or invalid. */
export function classifyQuery(raw) {
  const q = String(raw ?? "").trim();
  if (!q) return { type: "invalid", reason: "Enter a query" };
  if (/^\d{1,7}$/.test(q)) return { type: "height", value: q };
  if (/^[0-9a-fA-F]{64}$/.test(q)) {
    // Block hashes begin with many zero bits; otherwise treat as txid.
    return /^0{8}/.test(q) ? { type: "block", value: q.toLowerCase() } : { type: "tx", value: q.toLowerCase() };
  }
  if (/^(bc1|tb1)[a-z0-9]{11,87}$/i.test(q) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(q)) {
    return { type: "address", value: q };
  }
  return { type: "invalid", reason: "Not a txid, block hash, height or address" };
}

export function formatNumber(n) {
  return Number.isFinite(n) ? new Intl.NumberFormat("en-US").format(n) : "—";
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "kB", "MB", "GB"];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatHashrate(h) {
  if (!Number.isFinite(h)) return "—";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s", "ZH/s"];
  let i = 0;
  while (h >= 1000 && i < units.length - 1) { h /= 1000; i++; }
  return `${h.toFixed(2)} ${units[i]}`;
}

export function formatBtc(sats) {
  return Number.isFinite(sats) ? `${(sats / 1e8).toFixed(8)} BTC` : "—";
}

export function formatAge(unixSeconds, nowMs = Date.now()) {
  const s = Math.max(0, Math.floor(nowMs / 1000 - unixSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Fetch JSON/text with timeout; throws Error with a user-friendly message. */
export async function request(base, path, { text = false, timeoutMs = 10000, fetchImpl = globalThis.fetch } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(base + path, { signal: ctrl.signal, headers: { Accept: "application/json" }, credentials: "omit" });
    if (!res.ok) throw new Error(res.status === 404 ? "Not found" : `API error ${res.status}`);
    return text ? await res.text() : await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out");
    if (e instanceof TypeError) throw new Error("Network error – endpoint unreachable");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
