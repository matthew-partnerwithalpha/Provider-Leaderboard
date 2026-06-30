/* Provider Leaderboard dashboard
 * Reads ./data.json on load and renders everything from it.
 * Two views: "brands" (Partner Brand summary) and "providers"
 * (individual people, split into Injectors / Esty-Body-Wellness / Surgery).
 * The data file is the only thing that changes when the workbook refreshes,
 * so the dashboard never needs rebuilding. See SETUP-GUIDE.md.
 */

const state = {
  data: null,
  view: "brands",        // "brands" | "providers"
  providerType: null,    // active provider sub-tab label
  region: "All",
  search: "",
  sortKey: "revenue",
  sortDir: "desc",
  chart: null,
};

// ---- Column definitions per view ----
const BRAND_COLS = [
  { key: "rank", label: "#", cls: "rank-col", sort: false },
  { key: "brand", label: "Provider", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "rev_vs_lm", label: "vs Last Mo.", cls: "num", sort: true },
  { key: "rev_vs_sply", label: "vs Last Yr.", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "rebooked_rate", label: "Rebooked", cls: "num", sort: true },
  { key: "completed_rate", label: "Completed", cls: "num", sort: true },
];
const PROVIDER_COLS = [
  { key: "rank", label: "#", cls: "rank-col", sort: false },
  { key: "employee", label: "Provider", cls: "text-col", sort: true },
  { key: "brand", label: "Partner Brand", cls: "text-col", sort: true },
  { key: "region", label: "Region", cls: "text-col", sort: true },
  { key: "revenue", label: "Revenue", cls: "num", sort: true },
  { key: "visits", label: "Visits", cls: "num", sort: true },
  { key: "rpv", label: "RPV", cls: "num", sort: true },
  { key: "partner", label: "Partner", cls: "num", sort: true },
];

// ---- Formatting helpers ----
const fmtMoney = (n) =>
  n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const fmtMoneyK = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n);
};
const fmtNum = (n) =>
  n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-US");
const fmtPct = (n) =>
  n == null || isNaN(n) ? "—" : (n * 100).toFixed(1) + "%";
const fmtDelta = (n) => {
  if (n == null || isNaN(n)) return "—";
  return (n > 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
};
function deltaClass(n) {
  if (n == null || isNaN(n)) return "delta-flat";
  if (n > 0.0005) return "delta-up";
  if (n < -0.0005) return "delta-down";
  return "delta-flat";
}

// ---- Load ----
async function load() {
  try {
    const res = await fetch("./data.json?t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.data = await res.json();
    hydrate();
  } catch (err) {
    showError("Couldn't load data.json — make sure it sits next to index.html. (" + err.message + ")");
  }
}

function hydrate() {
  const d = state.data;
  // precompute brand deltas
  (d.brands || []).forEach((b) => {
    b.rev_vs_lm = b.revenue_lm ? (b.revenue - b.revenue_lm) / b.revenue_lm : null;
    b.rev_vs_sply = b.revenue_sply ? (b.revenue - b.revenue_sply) / b.revenue_sply : null;
  });
  // default provider sub-tab = first group
  const groups = d.provider_groups || {};
  state.providerType = Object.keys(groups)[0] || null;

  document.getElementById("period-label").textContent = d.period_label || "Current Period";
  document.getElementById("last-updated").textContent = formatTimestamp(d.generated_at);

  // hide Providers tab entirely if there's no provider data
  if (!state.providerType) {
    document.querySelector('.view-btn[data-view="providers"]').style.display = "none";
  }

  render();
  buildFootnote();
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ---- Current dataset (raw rows for the active view) ----
function currentRows() {
  if (state.view === "brands") return state.data.brands || [];
  return (state.data.provider_groups || {})[state.providerType] || [];
}
function nameKey() {
  return state.view === "brands" ? "brand" : "employee";
}

// ---- Filtering / sorting ----
function visibleRows() {
  let rows = currentRows().slice();
  if (state.region !== "All") rows = rows.filter((r) => r.region === state.region);
  if (state.search) {
    const q = state.search.toLowerCase();
    const nk = nameKey();
    rows = rows.filter(
      (r) => String(r[nk]).toLowerCase().includes(q) ||
             String(r.brand || "").toLowerCase().includes(q)
    );
  }
  const { sortKey, sortDir } = state;
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

// ---- Render orchestration ----
function render() {
  syncViewChrome();
  const rows = visibleRows();
  renderKpis();
  renderChart(rows);
  renderTableHead();
  renderTable(rows);
  syncSortHeaders();
}

// Show/hide sub-tabs, titles, etc. based on the active view
function syncViewChrome() {
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === state.view)
  );

  const subtabs = document.getElementById("provider-subtabs");
  if (state.view === "providers") {
    subtabs.hidden = false;
    const groups = Object.keys(state.data.provider_groups || {});
    subtabs.innerHTML = groups
      .map(
        (g) =>
          `<button class="subtab ${g === state.providerType ? "active" : ""}" data-group="${escapeAttr(g)}">${escapeHtml(prettyGroup(g))}</button>`
      )
      .join("");
    document.getElementById("chart-title").textContent = prettyGroup(state.providerType) + " — Revenue";
    document.getElementById("chart-hint").textContent = "Top 15 by revenue";
    document.getElementById("table-title").textContent = prettyGroup(state.providerType) + " Leaderboard";
    document.getElementById("search").placeholder = "Search a person or brand…";
  } else {
    subtabs.hidden = true;
    document.getElementById("chart-title").textContent = "Revenue by Provider";
    document.getElementById("chart-hint").textContent = "Ranked, current period";
    document.getElementById("table-title").textContent = "Detailed Leaderboard";
    document.getElementById("search").placeholder = "Search a provider…";
  }
  buildRegionFilters();
}

function prettyGroup(g) {
  return g === "Injectors" ? "Injectors"
    : g === "Surgery" ? "Surgery"
    : g; // "Esty / Body / Wellness"
}

// ---- Region filter buttons ----
function buildRegionFilters() {
  const regions = ["All", ...new Set(currentRows().map((r) => r.region).filter(Boolean))];
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

// ---- KPIs ----
function renderKpis() {
  const rows = state.region === "All"
    ? currentRows()
    : currentRows().filter((r) => r.region === state.region);

  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalVisits = rows.reduce((s, r) => s + (r.visits || 0), 0);
  const avgRpv = totalVisits ? totalRev / totalVisits : 0;

  let cards;
  if (state.view === "brands") {
    const totalRevLm = rows.reduce((s, r) => s + (r.revenue_lm || 0), 0);
    const revDelta = totalRevLm ? (totalRev - totalRevLm) / totalRevLm : null;
    const avgRebook = rows.length
      ? rows.reduce((s, r) => s + (r.rebooked_rate || 0), 0) / rows.length : 0;
    cards = [
      { label: "Total Revenue", value: fmtMoneyK(totalRev),
        sub: revDelta == null ? "" : `<span class="${deltaClass(revDelta)}">${fmtDelta(revDelta)}</span> vs last month` },
      { label: "Total Visits", value: fmtNum(totalVisits), sub: `${rows.length} providers` },
      { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
      { label: "Avg Rebooked Rate", value: fmtPct(avgRebook), sub: "across providers" },
    ];
  } else {
    const partners = rows.filter((r) => r.partner).length;
    cards = [
      { label: "Total Revenue", value: fmtMoneyK(totalRev), sub: prettyGroup(state.providerType) },
      { label: "People", value: fmtNum(rows.length), sub: `${partners} partners` },
      { label: "Total Visits", value: fmtNum(totalVisits), sub: "" },
      { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
    ];
  }

  document.getElementById("kpi-grid").innerHTML = cards
    .map((c) => `
      <div class="kpi">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
        ${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ""}
      </div>`).join("");
}

// ---- Ranking chart (top 15 in providers view) ----
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
    data: { labels, datasets: [{ label: "Revenue", data: values, backgroundColor: "#5b8def", borderRadius: 5, maxBarThickness: 26 }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => " " + fmtMoney(c.parsed.x) } },
      },
      scales: {
        x: { ticks: { color: "#9aa2b4", callback: (v) => fmtMoneyK(v) }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#e8eaf0", font: { size: 12 } }, grid: { display: false } },
      },
    },
  });
}

// ---- Table head (dynamic per view) ----
function renderTableHead() {
  const cols = state.view === "brands" ? BRAND_COLS : PROVIDER_COLS;
  document.getElementById("leaderboard-head").innerHTML =
    "<tr>" + cols.map((c) => {
      const cls = [c.cls, c.sort ? "sortable" : ""].filter(Boolean).join(" ");
      const attr = c.sort ? ` data-key="${c.key}"` : "";
      return `<th class="${cls}"${attr}>${escapeHtml(c.label)}</th>`;
    }).join("") + "</tr>";
}

// ---- Table body ----
function renderTable(rows) {
  const cols = state.view === "brands" ? BRAND_COLS : PROVIDER_COLS;
  const body = document.getElementById("leaderboard-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--text-dim);padding:28px">No results match.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((r, i) => {
    const topClass = i === 0 && state.sortDir === "desc" && state.sortKey === "revenue" ? "top-rank" : "";
    const cells = cols.map((c) => cell(r, c, i)).join("");
    return `<tr class="${topClass}">${cells}</tr>`;
  }).join("");
}

function cell(r, c, i) {
  switch (c.key) {
    case "rank": return `<td class="rank-col">${i + 1}</td>`;
    case "brand":
    case "employee":
      return `<td class="text-col"><span class="provider-name">${escapeHtml(r[c.key])}</span></td>`;
    case "region":
      return `<td class="text-col"><span class="region-pill">${escapeHtml(r.region || "—")}</span></td>`;
    case "revenue": return `<td class="num">${fmtMoney(r.revenue)}</td>`;
    case "rpv": return `<td class="num">${fmtMoney(r.rpv)}</td>`;
    case "visits": return `<td class="num">${fmtNum(r.visits)}</td>`;
    case "rev_vs_lm": return `<td class="num ${deltaClass(r.rev_vs_lm)}">${fmtDelta(r.rev_vs_lm)}</td>`;
    case "rev_vs_sply": return `<td class="num ${deltaClass(r.rev_vs_sply)}">${fmtDelta(r.rev_vs_sply)}</td>`;
    case "rebooked_rate": return `<td class="num">${fmtPct(r.rebooked_rate)}</td>`;
    case "completed_rate": return `<td class="num">${fmtPct(r.completed_rate)}</td>`;
    case "partner":
      return `<td class="num">${r.partner ? '<span class="partner-badge">Partner</span>' : '<span class="delta-flat">—</span>'}</td>`;
    default: return `<td class="num">${escapeHtml(String(r[c.key] ?? "—"))}</td>`;
  }
}

function syncSortHeaders() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.key === state.sortKey)
      th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
  });
}

function buildFootnote() {
  const d = state.data;
  const brandN = (d.brands || []).length;
  const provN = Object.values(d.provider_groups || {}).reduce((s, a) => s + a.length, 0);
  document.getElementById("footnote").textContent =
    `${brandN} partner brands · ${provN} providers · source: ${d.source || "workbook"} · auto-refreshes when the data file updates.`;
}

// ---- Utilities ----
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function showError(msg) {
  const el = document.getElementById("error-banner");
  el.textContent = msg;
  el.hidden = false;
}

// ---- Events ----
// Top-level view switch
document.getElementById("view-switch").addEventListener("click", (e) => {
  const btn = e.target.closest(".view-btn");
  if (!btn) return;
  const v = btn.dataset.view;
  if (v === state.view) return;
  state.view = v;
  state.region = "All";
  state.search = "";
  state.sortKey = "revenue";
  state.sortDir = "desc";
  document.getElementById("search").value = "";
  render();
});

// Provider sub-tabs
document.getElementById("provider-subtabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".subtab");
  if (!btn) return;
  state.providerType = btn.dataset.group;
  state.region = "All";
  state.sortKey = "revenue";
  state.sortDir = "desc";
  render();
});

// Column sort
document.getElementById("leaderboard").addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const key = th.dataset.key;
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = ["brand", "region", "employee"].includes(key) ? "asc" : "desc";
  }
  render();
});

// Search
document.getElementById("search").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  render();
});

load();
