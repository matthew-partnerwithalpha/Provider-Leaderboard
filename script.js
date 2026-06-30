/* Provider Leaderboard dashboard
 * Reads ./data.json on load and renders everything from it.
 * The data file is the only thing that changes when the workbook refreshes,
 * so the dashboard never needs rebuilding. See SETUP-GUIDE.md.
 */

const state = {
  rows: [],          // full dataset (with computed deltas)
  region: "All",     // active region filter
  search: "",        // search text
  sortKey: "revenue",// active sort column
  sortDir: "desc",   // "asc" | "desc"
  chart: null,
};

// ---- Formatting helpers ----
const fmtMoney = (n) =>
  n == null || isNaN(n) ? "—"
    : "$" + Math.round(n).toLocaleString("en-US");
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
  const sign = n > 0 ? "+" : "";
  return sign + (n * 100).toFixed(1) + "%";
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
    // cache-bust so the freshest data.json is always fetched
    const res = await fetch("./data.json?t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    hydrate(data);
  } catch (err) {
    showError(
      "Couldn't load data.json — make sure it sits next to index.html. (" +
        err.message + ")"
    );
  }
}

function hydrate(data) {
  const brands = Array.isArray(data.brands) ? data.brands : [];
  state.rows = brands.map((b) => {
    const rev_vs_lm =
      b.revenue_lm ? (b.revenue - b.revenue_lm) / b.revenue_lm : null;
    const rev_vs_sply =
      b.revenue_sply ? (b.revenue - b.revenue_sply) / b.revenue_sply : null;
    return { ...b, rev_vs_lm, rev_vs_sply };
  });

  document.getElementById("period-label").textContent =
    data.period_label || "Current Period";
  document.getElementById("last-updated").textContent =
    formatTimestamp(data.generated_at);

  buildRegionFilters();
  render();
  buildFootnote(data);
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ---- Region filter buttons ----
function buildRegionFilters() {
  const regions = ["All", ...new Set(state.rows.map((r) => r.region).filter(Boolean))];
  const wrap = document.getElementById("region-filters");
  wrap.innerHTML = "";
  regions.forEach((reg) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (reg === state.region ? " active" : "");
    btn.textContent = reg;
    btn.addEventListener("click", () => {
      state.region = reg;
      buildRegionFilters();
      render();
    });
    wrap.appendChild(btn);
  });
}

// ---- Filtering / sorting ----
function visibleRows() {
  let rows = state.rows.slice();
  if (state.region !== "All")
    rows = rows.filter((r) => r.region === state.region);
  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter((r) => r.brand.toLowerCase().includes(q));
  }
  const { sortKey, sortDir } = state;
  rows.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
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
  const rows = visibleRows();
  renderKpis();
  renderChart(rows);
  renderTable(rows);
  syncSortHeaders();
}

// ---- KPIs (always reflect current region filter) ----
function renderKpis() {
  const rows =
    state.region === "All"
      ? state.rows
      : state.rows.filter((r) => r.region === state.region);

  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalRevLm = rows.reduce((s, r) => s + (r.revenue_lm || 0), 0);
  const totalVisits = rows.reduce((s, r) => s + (r.visits || 0), 0);
  const avgRpv = totalVisits ? totalRev / totalVisits : 0;
  const avgRebook = rows.length
    ? rows.reduce((s, r) => s + (r.rebooked_rate || 0), 0) / rows.length
    : 0;
  const revDelta = totalRevLm ? (totalRev - totalRevLm) / totalRevLm : null;

  const cards = [
    { label: "Total Revenue", value: fmtMoneyK(totalRev),
      sub: revDelta == null ? "" : `<span class="${deltaClass(revDelta)}">${fmtDelta(revDelta)}</span> vs last month` },
    { label: "Total Visits", value: fmtNum(totalVisits), sub: `${rows.length} providers` },
    { label: "Avg Revenue / Visit", value: fmtMoney(avgRpv), sub: "blended" },
    { label: "Avg Rebooked Rate", value: fmtPct(avgRebook), sub: "across providers" },
  ];

  document.getElementById("kpi-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="kpi">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
        ${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ""}
      </div>`
    )
    .join("");
}

// ---- Revenue ranking chart ----
function renderChart(rows) {
  const sorted = rows.slice().sort((a, b) => b.revenue - a.revenue);
  const labels = sorted.map((r) => r.brand);
  const values = sorted.map((r) => Math.round(r.revenue));
  const ctx = document.getElementById("revenue-chart");

  const accent = "#5b8def";
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Revenue",
        data: values,
        backgroundColor: accent,
        borderRadius: 5,
        maxBarThickness: 26,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => " " + fmtMoney(c.parsed.x) },
        },
      },
      scales: {
        x: {
          ticks: { color: "#9aa2b4", callback: (v) => fmtMoneyK(v) },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "#e8eaf0", font: { size: 12 } },
          grid: { display: false },
        },
      },
    },
  });
}

// ---- Table ----
function renderTable(rows) {
  const body = document.getElementById("leaderboard-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:28px">No providers match.</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map((r, i) => {
      const topClass = i === 0 && state.sortDir === "desc" && state.sortKey === "revenue" ? "top-rank" : "";
      return `
      <tr class="${topClass}">
        <td class="rank-col">${i + 1}</td>
        <td class="text-col"><span class="provider-name">${escapeHtml(r.brand)}</span></td>
        <td class="text-col"><span class="region-pill">${escapeHtml(r.region || "—")}</span></td>
        <td class="num">${fmtMoney(r.revenue)}</td>
        <td class="num ${deltaClass(r.rev_vs_lm)}">${fmtDelta(r.rev_vs_lm)}</td>
        <td class="num ${deltaClass(r.rev_vs_sply)}">${fmtDelta(r.rev_vs_sply)}</td>
        <td class="num">${fmtNum(r.visits)}</td>
        <td class="num">${fmtMoney(r.rpv)}</td>
        <td class="num">${fmtPct(r.rebooked_rate)}</td>
        <td class="num">${fmtPct(r.completed_rate)}</td>
      </tr>`;
    })
    .join("");
}

function syncSortHeaders() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.key === state.sortKey)
      th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
  });
}

function buildFootnote(data) {
  const el = document.getElementById("footnote");
  el.textContent =
    `${state.rows.length} providers · source: ${data.source || "workbook"} · ` +
    `auto-refreshes when the data file updates.`;
}

// ---- Utilities ----
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function showError(msg) {
  const el = document.getElementById("error-banner");
  el.textContent = msg;
  el.hidden = false;
}

// ---- Events ----
document.addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const key = th.dataset.key;
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = ["brand", "region"].includes(key) ? "asc" : "desc";
  }
  render();
});

document.getElementById("search").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  render();
});

load();
