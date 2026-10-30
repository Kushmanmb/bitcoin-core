import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateEndpoint, classifyQuery, formatBytes, formatHashrate, formatBtc, formatAge, request } from "../js/lib.js";

test("validateEndpoint", () => {
  assert.equal(validateEndpoint("https://mempool.space/api/"), "https://mempool.space/api");
  assert.equal(validateEndpoint("http://localhost:8999/api"), "http://localhost:8999/api");
  assert.throws(() => validateEndpoint("http://example.com"));
  assert.throws(() => validateEndpoint("https://user:pw@example.com"));
  assert.throws(() => validateEndpoint("javascript:alert(1)"));
  assert.throws(() => validateEndpoint("nope"));
});

test("classifyQuery", () => {
  assert.equal(classifyQuery("840000").type, "height");
  assert.equal(classifyQuery("0".repeat(8) + "a".repeat(56)).type, "block");
  assert.equal(classifyQuery("a".repeat(64)).type, "tx");
  assert.equal(classifyQuery("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq").type, "address");
  assert.equal(classifyQuery("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").type, "address");
  assert.equal(classifyQuery("<script>").type, "invalid");
  assert.equal(classifyQuery("").type, "invalid");
});

test("formatters", () => {
  assert.equal(formatBytes(1500), "1.5 kB");
  assert.equal(formatHashrate(6e20), "600.00 EH/s");
  assert.equal(formatBtc(100000000), "1.00000000 BTC");
  assert.equal(formatAge(0, 120000), "2m ago");
  assert.equal(formatBytes(NaN), "—");
});

test("request error handling", async () => {
  const ok = async () => ({ ok: true, json: async () => ({ a: 1 }) });
  assert.deepEqual(await request("https://x", "/p", { fetchImpl: ok }), { a: 1 });
  const nf = async () => ({ ok: false, status: 404 });
  await assert.rejects(request("https://x", "/p", { fetchImpl: nf }), /Not found/);
  const net = async () => { throw new TypeError("fail"); };
  await assert.rejects(request("https://x", "/p", { fetchImpl: net }), /Network error/);
});

test("static security checks", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)/i, "no inline scripts");
  assert.doesNotMatch(html, /\son\w+=/i, "no inline handlers");
  assert.match(html, /<html lang="en">/);
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /innerHTML|eval\(|document\.write/);
  for (const f of ["config.json", "js/app.js", "js/lib.js"]) {
    const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /rpcuser|rpcpassword|rpcauth/i);
  }
  JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
});
