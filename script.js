/* Alpha Leaderboard dashboard
 * Views: "brands" (Partner Brand) and "providers" (Injectors / Esty-Body-Wellness / Surgery).
 * Segments: MTD, Q1, Q2, Q3, YTD. Reads ./data.json. See SETUP-GUIDE.md.
 */
const state = {
  data: null, view: "brands", segment: "MTD", providerType: null,
  includePartners: true, region: "All", search: "",
  sortKey: "revenue", sortDir: "desc", chart: null,
};

function isRevenueOnly(brand) {
  const n = String(brand || "").toLowerCase();
  return n.indexOf("lexrx") !== -1 || n.indexOf("lex rx") !== -1 || n.indexOf("bair") !== -1;
}
const DASH_KEYS = ["visits", "rpv", "rpd", "clinics_days_worked", "rebooked_rate", "completed_rate"];

const BRAND_COLS_MTD = [
  { key: "rank", label: "#", cls: "rank-col" },
  { key: "brand", label: "Partner Brand", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "rebooked_rate", label: "Rebooked", cls: "num", sort: true },
  { key: "completed_rate", label: "Completed", cls: "num", sort: true },
  { key: "pct_budget", label: "% of Budget", cls: "num", sort: true },
  { key: "revenue_lm", label: "Revenue LM", cls: "num", sort: true },
  { key: "revenue_sply", label: "Revenue SPLY", cls: "num", sort: true },
];
const BRAND_COLS_SEG = [
  { key: "rank", label: "#", cls: "rank-col" },
  { key: "brand", label: "Partner Brand", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "rebooked_rate", label: "Rebooked", cls: "num", sort: true },
  { key: "completed_rate", label: "Completed", cls: "num", sort: true },
];
const PROVIDER_COLS_MTD = [
  { key: "rank", label: "#", cls: "rank-col" },
  { key: "employee", label: "Provider", cls: "text-col", sort: true },
  { key: "brand", label: "Partner Brand", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "rpd", label: "RPD", cls: "num", sort: true },
  { key: "clinics_days_worked", label: "Clinic Days", cls: "num", sort: true },
  { key: "rebooked_rate", label: "Rebooked", cls: "num", sort: true },
  { key: "completed_rate", label: "Completed", cls: "num", sort: true },
  { key: "revenue_lm", label: "Revenue LM", cls: "num", sort: true },
  { key: "partner", label: "Partner", cls: "num", sort: true },
];
const PROVIDER_COLS_SEG = [
  { key: "rank", label: "#", cls: "rank-col" },
  { key: "employee", label: "Provider", cls: "text-col", sort: true },
  { key: "brand", label: "Partner Brand", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "rpd", label: "RPD", cls: "num", sort: true },
  { key: "clinics_days_worked", label: "Clinic Days", cls: "num", sort: true },
  { key: "rebooked_rate", label: "Rebooked", cls: "num", sort: true },
  { key: "completed_rate", label: "Completed", cls: "num", sort: true },
  { key: "partner", label: "Partner", cls: "num", sort: true },
];

function activeCols() {
  const mtd = state.segment === "MTD";
  if (state.view === "brands") return mtd ? BRAND_COLS_MTD : BRAND_COLS_SEG;
  return mtd ? PROVIDER_COLS_MTD : PROVIDER_COLS_SEG;
}

const fmtMoney = (n) => (n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const fmtMoneyK = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n);
};
const fmtNum = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-US"));
const fmtPct = (n) => (n == null || isNaN(n) ? "—" : (n * 100).toFixed(1) + "%");

async function load() {
  try {
    const res = await fetch("./data.json?t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.data = await res.json();
    hydrate();
  } catch (err) {
    showError("Couldn't load data.json - make sure it sits next to index.html. (" + err.message + ")");
  }
}

function hydrate() {
  const d = state.data;
  state.providerType = Object.keys(d.provider_groups || {})[0] || null;
  document.getElementById("last-updated").textContent = formatTimestamp(d.generated_at);
  buildSegmentSwitch();
  buildTicker();
  render();
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function segLabel(seg) { return (state.data.segment_labels && state.data.segment_labels[seg]) || seg; }

/* ===== Ticker (MTD highlight reel) ===== */
function buildTicker() {
  const d = state.data;
  const b = (d.brands && d.brands.MTD) || [];
  const g = d.provider_groups || {};
  const inj = ((g["Injectors"] || {}).MTD || []).filter((r) => r.revenue > 0);
  const esty = ((g["Esty / Body / Wellness"] || {}).MTD || []).filter((r) => r.revenue > 0);
  const surg = ((g["Surgery"] || {}).MTD || []).filter((r) => r.revenue > 0);
  const brands = b.filter((r) => r.revenue > 0);
  const brandsM = brands.filter((r) => !isRevenueOnly(r.brand));
  const allProv = inj.concat(esty, surg).filter((r) => !isRevenueOnly(r.brand));

  const top = (rows, key, n) => rows.filter((r) => r[key] != null && r[key] > 0)
    .sort((a, x) => x[key] - a[key]).slice(0, n || 10);

  const cats = [
    { t: "Top Injectors", rows: top(inj, "revenue"), key: "revenue", fmt: fmtMoneyK, nk: "employee" },
    { t: "Top Esty / Body / Wellness", rows: top(esty, "revenue"), key: "revenue", fmt: fmtMoneyK, nk: "employee" },
    { t: "Top Surgery", rows: top(surg, "revenue"), key: "revenue", fmt: fmtMoneyK, nk: "employee" },
    { t: "Highest RPD · Providers", rows: top(allProv, "rpd"), key: "rpd", fmt: fmtMoney, nk: "employee" },
    { t: "Most Visits · Providers", rows: top(allProv, "visits"), key: "visits", fmt: fmtNum, nk: "employee" },
    { t: "Best Rebook Rate · Providers", rows: top(allProv, "rebooked_rate"), key: "rebooked_rate", fmt: fmtPct, nk: "employee" },
    { t: "Best Completed Rate · Providers", rows: top(allProv, "completed_rate"), key: "completed_rate", fmt: fmtPct, nk: "employee" },
    { t: "Top Partner Brands", rows: top(brands, "revenue"), key: "revenue", fmt: fmtMoneyK, nk: "brand" },
    { t: "Highest RPV · Partner Brands", rows: top(brandsM, "rpv"), key: "rpv", fmt: fmtMoney, nk: "brand" },
    { t: "Best % of Budget · Partner Brands", rows: top(brandsM, "pct_budget"), key: "pct_budget", fmt: fmtPct, nk: "brand" },
    { t: "Most Visits · Partner Brands", rows: top(brandsM, "visits"), key: "visits", fmt: fmtNum, nk: "brand" },
    { t: "Best Rebook Rate · Partner Brands", rows: top(brandsM, "rebooked_rate"), key: "rebooked_rate", fmt: fmtPct, nk: "brand" },
    { t: "Best Completed Rate · Partner Brands", rows: top(brandsM, "completed_rate"), key: "completed_rate", fmt: fmtPct, nk: "brand" },
  ];

  let html = "", count = 0;
  cats.forEach((c) => {
    if (!c.rows.length) return;
    html += `<span class="tk-cat">&#9654; ${escapeHtml(c.t)}</span>`;
    c.rows.forEach((r, i) => {
      count++;
      html += `<span class="tk-item"><span class="tk-rank">${i + 1}</span>${escapeHtml(String(r[c.nk]))}<span class="tk-val">${c.fmt(r[c.key])}</span></span>`;
      if (i < c.rows.length - 1) html += `<span class="tk-sep">&bull;</span>`;
    });
  });
  if (!html) { document.getElementById("ticker").style.display = "none"; return; }

  const track = document.getElementById("ticker-track");
  track.innerHTML = html + html; // duplicate for seamless loop
  // set scroll speed: measure width if possible, else estimate from item count
  const w = track.scrollWidth || 0;
  const dur = w ? (w / 2 / 90) : (count * 1.5);
  track.style.animationDuration = Math.max(40, Math.round(dur)) + "s";
}

function baseRows() {
  const d = state.data;
  if (state.view === "brands") return (d.brands && d.brands[state.segment]) || [];
  const grp = (d.provider_groups && d.provider_groups[state.providerType]) || {};
  let rows = grp[state.segment] || [];
  if (!state.includePartners) rows = rows.filter((r) => !r.partner);
  return rows;
}
function nameKey() { return state.view === "brands" ? "brand" : "employee"; }

function buildSegmentSwitch() {
  const segs = state.data.segments || ["MTD", "Q1", "Q2", "Q3", "YTD"];
  document.getElementById("segment-switch").innerHTML = segs
    .map((s) => `<button class="seg-btn ${s === state.segment ? "active" : ""}" data-seg="${s}">${escapeHtml(segLabel(s))}</button>`)
    .join("");
}

function visibleRows() {
  let rows = baseRows().slice();
  rows = rows.filter((r) => r.revenue != null && r.revenue > 0);
  if (state.region !== "All") rows = rows.filter((r) => r.region === state.region);
  if (state.search) {
    const q = state.search.toLowerCase(), nk = nameKey();
    rows = rows.filter((r) => String(r[nk]).toLowerCase().includes(q) || String(r.brand || "").toLowerCase().includes(q));
  }
  const sortKey = state.sortKey, sortDir = state.sortDir;
  rows.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === "boolean") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
    if (typeof va === "string") { va = va.toLowerCase(); vb = String(vb || "").toLowerCase(); }
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return rows;
}

function render() {
  syncChrome();
  const rows = visibleRows();
  renderSummary(rows);
  renderKpis(rows);
  renderChart(rows);
  renderHead();
  renderBody(rows);
  syncSortHeaders();
}

function syncChrome() {
  document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.seg === state.segment));
  document.getElementById("period-label").textContent = segLabel(state.segment);
  const subtabs = document.getElementById("provider-subtabs");
  const partnerWrap = document.getElementById("partner-toggle-wrap");
  const summary = document.getElementById("provider-summary");
  if (state.view === "providers") {
    subtabs.hidden = false; partnerWrap.hidden = false; summary.hidden = false;
    const groups = Object.keys(state.data.provider_groups || {});
    subtabs.innerHTML = groups
      .map((gp) => `<button class="subtab ${gp === state.providerType ? "active" : ""}" data-group="${escapeAttr(gp)}">${escapeHtml(gp)}</button>`)
      .join("");
    document.getElementById("chart-title").textContent = state.providerType + " — Revenue";
    document.getElementById("chart-hint").textContent = "Top 15 by revenue · " + segLabel(state.segment);
    document.getElementById("table-title").textContent = state.providerType + " Leaderboard — " + segLabel(state.segment);
    document.getElementById("search").placeholder = "Search a person or brand...";
  } else {
    subtabs.hidden = true; partnerWrap.hidden = true; summary.hidden = true;
    document.getElementById("chart-title").textContent = "Revenue by Partner Brand";
    document.getElementById("chart-hint").textContent = "Ranked · " + segLabel(state.segment);
    document.getElementById("table-title").textContent = "Detailed Leaderboard — " + segLabel(state.segment);
    document.getElementById("search").placeholder = "Search a partner brand...";
  }
  buildRegionFilters();
}

function buildRegionFilters() {
  const regions = ["All"].concat([...new Set(baseRows().map((r) => r.region).filter(Boolean))]);
  const wrap = document.getElementById("region-filters");
  wrap.innerHTML = "";
  regions.forEach((reg) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (reg === state.region ? " active" : "");
    btn.textContent = reg;
    btn.addEventListener("click", () => { state.region = reg; render(); });
    wrap.appendChild(btn);
  });
}

function renderSummary(rows) {
  if (state.view !== "providers") return;
  const top = rows.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const ranks = ["1ST", "2ND", "3RD"];
  const el = document.getElementById("provider-summary");
  if (!top.length) { el.innerHTML = ""; return; }
  el.innerHTML = top.map((r, i) => {
    const ro = isRevenueOnly(r.brand);
    const sub = ro ? "" : `${fmtNum(r.visits)} visits · ${fmtMoney(r.rpd)} RPD`;
    return `<div class="podium ${i === 0 ? "rank1" : ""}">
      <div class="podium-rank">${ranks[i]} · ${escapeHtml(state.providerType)}</div>
      <div class="podium-name">${escapeHtml(r.employee)}</div>
      <div class="podium-brand">${escapeHtml(r.brand || "")}</div>
      <div class="podium-rev">${fmtMoney(r.revenue)}</div>
      ${sub ? `<div class="podium-sub">${sub}</div>` : ""}
    </div>`;
  }).join("");
}

function renderKpis(rows) {
  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalVisits = rows.reduce((s, r) => s + (r.visits || 0), 0);
  const avgRpv = totalVisits ? totalRev / totalVisits : 0;
  let cards;
  if (state.view === "brands") {
    const wr = rows.filter((r) => r.rebooked_rate != null && !isRevenueOnly(r.brand));
    const avgReb = wr.length ? wr.reduce((s, r) => s + r.rebooked_rate, 0) / wr.length : 0;
    cards = [
      { label: "Total Revenue", value: fmtMoneyK(totalRev), sub: segLabel(state.segment) },
      { label: "Total Visits", value: fmtNum(totalVisits), sub: rows.length + " partner brands" },
      { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
      { label: "Avg Rebooked Rate", value: fmtPct(avgReb), sub: "collected brands" },
    ];
  } else {
    const partners = rows.filter((r) => r.partner).length;
    cards = [
      { label: "Total Revenue", value: fmtMoneyK(totalRev), sub: segLabel(state.segment) },
      { label: "People", value: fmtNum(rows.length), sub: partners + " partners" + (state.includePartners ? "" : " (excluded)") },
      { label: "Total Visits", value: fmtNum(totalVisits), sub: "" },
      { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
    ];
  }
  document.getElementById("kpi-grid").innerHTML = cards
    .map((c) => `<div class="kpi"><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div>${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ""}</div>`)
    .join("");
}

function renderChart(rows) {
  let sorted = rows.slice().sort((a, b) => b.revenue - a.revenue);
  if (state.view === "providers") sorted = sorted.slice(0, 15);
  const nk = nameKey();
  const labels = sorted.map((r) => r[nk]);
  const values = sorted.map((r) => Math.round(r.revenue));
  const canvas = document.getElementById("revenue-chart");
  // gradient fill (lavender -> yellow); fall back to solid if unavailable
  let fill = "#B7A6C8";
  try {
    const g2 = canvas.getContext && canvas.getContext("2d");
    if (g2 && g2.createLinearGradient) {
      const grad = g2.createLinearGradient(0, 0, canvas.width || 900, 0);
      grad.addColorStop(0, "#B7A6C8"); grad.addColorStop(1, "#EAD98E");
      fill = grad;
    }
  } catch (e) {}
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(canvas, {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Revenue", data: values, backgroundColor: fill, borderRadius: 6, maxBarThickness: 26 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmtMoney(c.parsed.x) } } },
      scales: {
        x: { ticks: { color: "#A79FB2", callback: (v) => fmtMoneyK(v) }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#F1F1E7", font: { size: 12, weight: "600" } }, grid: { display: false } },
      },
    },
  });
}

function renderHead() {
  const cols = activeCols();
  document.getElementById("leaderboard-head").innerHTML =
    "<tr>" + cols.map((c) => {
      const cls = [c.cls, c.sort ? "sortable" : ""].filter(Boolean).join(" ");
      const attr = c.sort ? ` data-key="${c.key}"` : "";
      return `<th class="${cls}"${attr}>${escapeHtml(c.label)}</th>`;
    }).join("") + "</tr>";
}

function renderBody(rows) {
  const cols = activeCols();
  const body = document.getElementById("leaderboard-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--muted);padding:28px">No results with revenue yet.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((r, i) => {
    const topClass = i === 0 && state.sortDir === "desc" && state.sortKey === "revenue" ? "top-rank" : "";
    return `<tr class="${topClass}">` + cols.map((c) => cell(r, c, i)).join("") + "</tr>";
  }).join("");
}

function cell(r, c, i) {
  const ro = isRevenueOnly(r.brand);
  if (ro && DASH_KEYS.indexOf(c.key) !== -1) return `<td class="num muted-dash">—</td>`;
  switch (c.key) {
    case "rank": return `<td class="rank-col">${i + 1}</td>`;
    case "brand":
    case "employee": return `<td class="text-col"><span class="provider-name">${escapeHtml(r[c.key])}</span></td>`;
    case "region": return `<td class="text-col"><span class="region-pill">${escapeHtml(r.region || "—")}</span></td>`;
    case "revenue": return `<td class="num">${fmtMoney(r.revenue)}</td>`;
    case "revenue_lm": return `<td class="num">${fmtMoney(r.revenue_lm)}</td>`;
    case "revenue_sply": return `<td class="num">${fmtMoney(r.revenue_sply)}</td>`;
    case "rpv": return `<td class="num">${fmtMoney(r.rpv)}</td>`;
    case "rpd": return `<td class="num">${fmtMoney(r.rpd)}</td>`;
    case "clinics_days_worked": return `<td class="num">${fmtNum(r.clinics_days_worked)}</td>`;
    case "visits": return `<td class="num">${fmtNum(r.visits)}</td>`;
    case "pct_budget": return `<td class="num">${fmtPct(r.pct_budget)}</td>`;
    case "rebooked_rate": return `<td class="num">${fmtPct(r.rebooked_rate)}</td>`;
    case "completed_rate": return `<td class="num">${fmtPct(r.completed_rate)}</td>`;
    case "partner": return `<td class="num">${r.partner ? '<span class="partner-badge">Partner</span>' : '<span class="muted-dash">—</span>'}</td>`;
    default: return `<td class="num">${escapeHtml(String(r[c.key] == null ? "—" : r[c.key]))}</td>`;
  }
}

function syncSortHeaders() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.key === state.sortKey) th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
function showError(msg) { const el = document.getElementById("error-banner"); el.textContent = msg; el.hidden = false; }

document.getElementById("view-switch").addEventListener("click", (e) => {
  const btn = e.target.closest(".view-btn");
  if (!btn || btn.dataset.view === state.view) return;
  state.view = btn.dataset.view;
  state.region = "All"; state.search = ""; state.sortKey = "revenue"; state.sortDir = "desc";
  document.getElementById("search").value = "";
  render();
});
document.getElementById("segment-switch").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn || btn.dataset.seg === state.segment) return;
  state.segment = btn.dataset.seg;
  if (!activeCols().some((c) => c.key === state.sortKey)) { state.sortKey = "revenue"; state.sortDir = "desc"; }
  render();
});
document.getElementById("provider-subtabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".subtab");
  if (!btn) return;
  state.providerType = btn.dataset.group;
  state.region = "All"; state.sortKey = "revenue"; state.sortDir = "desc";
  render();
});
document.getElementById("partner-toggle").addEventListener("change", (e) => { state.includePartners = e.target.checked; render(); });
document.getElementById("leaderboard").addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const key = th.dataset.key;
  if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else { state.sortKey = key; state.sortDir = ["brand", "region", "employee"].indexOf(key) !== -1 ? "asc" : "desc"; }
  render();
});
document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value.trim(); render(); });

load();
