/* Provider Leaderboard dashboard
 * Views: "brands" (Partner Brand) and "providers" (Injectors / Esty-Body-Wellness / Surgery).
 * Time segments: MTD, Q1, Q2, YTD. Reads ./data.json. See SETUP-GUIDE.md.
 */

const state = {
  data: null,
  view: "brands",
  segment: "MTD",
  providerType: null,
  includePartners: true,
  region: "All",
  search: "",
  sortKey: "revenue",
  sortDir: "desc",
  chart: null,
};

const BRAND_COLS_MTD = [
  { key: "rank", label: "#", cls: "rank-col" },
  { key: "brand", label: "Provider", cls: "text-col", sort: true },
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
  { key: "brand", label: "Provider", cls: "text-col", sort: true },
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
  render();
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function segLabel(seg) {
  return (state.data.segment_labels && state.data.segment_labels[seg]) || seg;
}

function currentRows() {
  const d = state.data;
  let rows;
  if (state.view === "brands") {
    rows = (d.brands && d.brands[state.segment]) || [];
  } else {
    const grp = (d.provider_groups && d.provider_groups[state.providerType]) || {};
    rows = grp[state.segment] || [];
    if (!state.includePartners) rows = rows.filter((r) => !r.partner);
  }
  return rows;
}
function nameKey() { return state.view === "brands" ? "brand" : "employee"; }

function buildSegmentSwitch() {
  const segs = state.data.segments || ["MTD", "Q1", "Q2", "YTD"];
  const wrap = document.getElementById("segment-switch");
  wrap.innerHTML = segs
    .map((s) => `<button class="seg-btn ${s === state.segment ? "active" : ""}" data-seg="${s}">${escapeHtml(segLabel(s))}</button>`)
    .join("");
}

function visibleRows() {
  let rows = currentRows().slice();
  if (state.region !== "All") rows = rows.filter((r) => r.region === state.region);
  if (state.search) {
    const q = state.search.toLowerCase();
    const nk = nameKey();
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
  renderKpis();
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

  if (state.view === "providers") {
    subtabs.hidden = false;
    const groups = Object.keys(state.data.provider_groups || {});
    subtabs.innerHTML = groups
      .map((g) => `<button class="subtab ${g === state.providerType ? "active" : ""}" data-group="${escapeAttr(g)}">${escapeHtml(g)}</button>`)
      .join("");
    partnerWrap.hidden = false;
    document.getElementById("chart-title").textContent = state.providerType + " — Revenue";
    document.getElementById("chart-hint").textContent = "Top 15 by revenue · " + segLabel(state.segment);
    document.getElementById("table-title").textContent = state.providerType + " Leaderboard — " + segLabel(state.segment);
    document.getElementById("search").placeholder = "Search a person or brand...";
  } else {
    subtabs.hidden = true;
    partnerWrap.hidden = true;
    document.getElementById("chart-title").textContent = "Revenue by Provider";
    document.getElementById("chart-hint").textContent = "Ranked · " + segLabel(state.segment);
    document.getElementById("table-title").textContent = "Detailed Leaderboard — " + segLabel(state.segment);
    document.getElementById("search").placeholder = "Search a provider...";
  }
  buildRegionFilters();
}

function buildRegionFilters() {
  const regions = ["All"].concat([...new Set(currentRows().map((r) => r.region).filter(Boolean))]);
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

function renderKpis() {
  const rows = state.region === "All" ? currentRows() : currentRows().filter((r) => r.region === state.region);
  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalVisits = rows.reduce((s, r) => s + (r.visits || 0), 0);
  const avgRpv = totalVisits ? totalRev / totalVisits : 0;

  let cards;
  if (state.view === "brands") {
    const avgReb = rows.length ? rows.reduce((s, r) => s + (r.rebooked_rate || 0), 0) / rows.length : 0;
    cards = [
      { label: "Total Revenue", value: fmtMoneyK(totalRev), sub: segLabel(state.segment) },
      { label: "Total Visits", value: fmtNum(totalVisits), sub: rows.length + " providers" },
      { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
      { label: "Avg Rebooked Rate", value: fmtPct(avgReb), sub: "across providers" },
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
  const ctx = document.getElementById("revenue-chart");
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Revenue", data: values, backgroundColor: "#5b8def", borderRadius: 5, maxBarThickness: 26 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmtMoney(c.parsed.x) } } },
      scales: {
        x: { ticks: { color: "#9aa2b4", callback: (v) => fmtMoneyK(v) }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#e8eaf0", font: { size: 12 } }, grid: { display: false } },
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
    body.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--text-dim);padding:28px">No results match.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((r, i) => {
    const topClass = i === 0 && state.sortDir === "desc" && state.sortKey === "revenue" ? "top-rank" : "";
    return `<tr class="${topClass}">` + cols.map((c) => cell(r, c, i)).join("") + "</tr>";
  }).join("");
}

function cell(r, c, i) {
  switch (c.key) {
    case "rank": return `<td class="rank-col">${i + 1}</td>`;
    case "brand":
    case "employee": return `<td class="text-col"><span class="provider-name">${escapeHtml(r[c.key])}</span></td>`;
    case "region": return `<td class="text-col"><span class="region-pill">${escapeHtml(r.region || "—")}</span></td>`;
    case "revenue": return `<td class="num">${fmtMoney(r.revenue)}</td>`;
    case "revenue_lm": return `<td class="num">${fmtMoney(r.revenue_lm)}</td>`;
    case "revenue_sply": return `<td class="num">${fmtMoney(r.revenue_sply)}</td>`;
    case "rpv": return `<td class="num">${fmtMoney(r.rpv)}</td>`;
    case "visits": return `<td class="num">${fmtNum(r.visits)}</td>`;
    case "pct_budget": return `<td class="num">${fmtPct(r.pct_budget)}</td>`;
    case "rebooked_rate": return `<td class="num">${fmtPct(r.rebooked_rate)}</td>`;
    case "completed_rate": return `<td class="num">${fmtPct(r.completed_rate)}</td>`;
    case "partner": return `<td class="num">${r.partner ? '<span class="partner-badge">Partner</span>' : '<span class="delta-flat">—</span>'}</td>`;
    default: return `<td class="num">${escapeHtml(String(r[c.key] == null ? "—" : r[c.key]))}</td>`;
  }
}

function syncSortHeaders() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.key === state.sortKey) th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
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

document.getElementById("partner-toggle").addEventListener("change", (e) => {
  state.includePartners = e.target.checked;
  render();
});

document.getElementById("leaderboard").addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const key = th.dataset.key;
  if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else { state.sortKey = key; state.sortDir = ["brand", "region", "employee"].includes(key) ? "asc" : "desc"; }
  render();
});

document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value.trim(); render(); });

load();
