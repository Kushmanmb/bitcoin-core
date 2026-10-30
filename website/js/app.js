import { DEFAULT_CONFIG, validateEndpoint, classifyQuery, formatNumber, formatBytes, formatHashrate, formatBtc, formatAge, request } from "./lib.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "btc-dashboard-endpoint";
let base = DEFAULT_CONFIG.apiBase;
let refreshSeconds = DEFAULT_CONFIG.refreshSeconds;
let timer;

function setState(panel, state, message) {
  const el = $(panel);
  el.dataset.state = state; // loading | ready | error
  const status = el.querySelector(".status");
  status.textContent = state === "loading" ? "Loading…" : state === "error" ? message : "";
  status.hidden = state === "ready";
  status.setAttribute("role", state === "error" ? "alert" : "status");
}

function setStat(id, value) { $(id).textContent = value; }

function row(parent, label, value) {
  const dt = document.createElement("dt"); dt.textContent = label;
  const dd = document.createElement("dd"); dd.textContent = value;
  parent.append(dt, dd);
}

async function loadConfig() {
  try {
    const res = await fetch("config.json", { cache: "no-cache" });
    if (res.ok) {
      const cfg = await res.json();
      base = validateEndpoint(cfg.apiBase ?? base);
      refreshSeconds = Math.max(15, Number(cfg.refreshSeconds) || refreshSeconds);
    }
  } catch { /* fall back to defaults */ }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { base = validateEndpoint(saved); } catch { localStorage.removeItem(STORAGE_KEY); } }
  $("endpoint-input").value = base;
}

async function panel(id, fn) {
  setState(id, "loading");
  try { await fn(); setState(id, "ready"); }
  catch (e) { setState(id, "error", e.message); }
}

function refresh() {
  $("endpoint-label").textContent = new URL(base).host;
  panel("panel-network", async () => {
    const [height, diff, hash, price] = await Promise.all([
      request(base, "/blocks/tip/height", { text: true }),
      request(base, "/v1/difficulty-adjustment"),
      request(base, "/v1/mining/hashrate/3d"),
      request(base, "/v1/prices").catch(() => null),
    ]);
    setStat("stat-height", formatNumber(Number(height)));
    setStat("stat-hashrate", formatHashrate(hash.currentHashrate));
    setStat("stat-difficulty", formatNumber(Math.round(hash.currentDifficulty)));
    setStat("stat-retarget", `${diff.progressPercent.toFixed(1)}% · ${formatNumber(diff.remainingBlocks)} blocks left`);
    setStat("stat-price", price ? `$${formatNumber(price.USD)}` : "unavailable");
  });
  panel("panel-fees", async () => {
    const f = await request(base, "/v1/fees/recommended");
    setStat("fee-fastest", `${f.fastestFee} sat/vB`);
    setStat("fee-half", `${f.halfHourFee} sat/vB`);
    setStat("fee-hour", `${f.hourFee} sat/vB`);
    setStat("fee-economy", `${f.economyFee} sat/vB`);
  });
  panel("panel-mempool", async () => {
    const m = await request(base, "/mempool");
    setStat("mp-count", formatNumber(m.count));
    setStat("mp-size", formatBytes(m.vsize));
    setStat("mp-fees", formatBtc(m.total_fee));
  });
  panel("panel-blocks", async () => {
    const blocks = await request(base, "/v1/blocks");
    const body = $("blocks-body");
    body.replaceChildren();
    for (const b of blocks.slice(0, 10)) {
      const tr = document.createElement("tr");
      const cells = [formatNumber(b.height), formatAge(b.timestamp), formatNumber(b.tx_count), formatBytes(b.size), b.extras?.pool?.name ?? "—"];
      cells.forEach((c, i) => {
        const td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) {
          td.scope = "row";
          const btn = document.createElement("button");
          btn.type = "button"; btn.className = "link"; btn.textContent = c;
          btn.addEventListener("click", () => { $("search-input").value = String(b.height); search(String(b.height)); });
          td.append(btn);
        } else td.textContent = c;
        tr.append(td);
      });
      body.append(tr);
    }
  });
}

async function search(raw) {
  const out = $("search-result");
  const q = classifyQuery(raw);
  out.replaceChildren();
  if (q.type === "invalid") { setState("panel-search", "error", q.reason); return; }
  setState("panel-search", "loading");
  try {
    const dl = document.createElement("dl");
    if (q.type === "height" || q.type === "block") {
      const hash = q.type === "height" ? await request(base, `/block-height/${q.value}`, { text: true }) : q.value;
      const b = await request(base, `/block/${encodeURIComponent(hash)}`);
      row(dl, "Type", "Block"); row(dl, "Hash", b.id); row(dl, "Height", formatNumber(b.height));
      row(dl, "Time", new Date(b.timestamp * 1000).toUTCString()); row(dl, "Transactions", formatNumber(b.tx_count));
      row(dl, "Size", formatBytes(b.size));
    } else if (q.type === "tx") {
      const t = await request(base, `/tx/${q.value}`);
      row(dl, "Type", "Transaction"); row(dl, "TXID", t.txid); row(dl, "Fee", formatBtc(t.fee));
      row(dl, "Size", `${formatNumber(t.weight)} WU`);
      row(dl, "Status", t.status?.confirmed ? `Confirmed in block ${formatNumber(t.status.block_height)}` : "Unconfirmed");
    } else {
      const a = await request(base, `/address/${encodeURIComponent(q.value)}`);
      const c = a.chain_stats;
      row(dl, "Type", "Address"); row(dl, "Address", a.address);
      row(dl, "Balance", formatBtc(c.funded_txo_sum - c.spent_txo_sum)); row(dl, "Transactions", formatNumber(c.tx_count));
    }
    out.append(dl);
    setState("panel-search", "ready");
  } catch (e) { setState("panel-search", "error", e.message); }
}

function init() {
  $("search-form").addEventListener("submit", (e) => { e.preventDefault(); search($("search-input").value); });
  $("endpoint-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("endpoint-error");
    try {
      base = validateEndpoint($("endpoint-input").value);
      localStorage.setItem(STORAGE_KEY, base);
      err.textContent = ""; refresh();
    } catch (ex) { err.textContent = ex.message; }
  });
  $("endpoint-reset").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });
  $("refresh-btn").addEventListener("click", refresh);
  const nav = document.querySelectorAll(".nav a");
  nav.forEach((a) => a.addEventListener("click", () => { $("nav-toggle").setAttribute("aria-expanded", "false"); $("site-nav").classList.remove("open"); }));
  $("nav-toggle").addEventListener("click", (e) => {
    const open = $("site-nav").classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
  });
}

await loadConfig();
init();
refresh();
timer = setInterval(() => { if (!document.hidden) refresh(); }, refreshSeconds * 1000);
