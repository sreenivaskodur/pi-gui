// node_modules/@earendil-works/chord/dist/context/index.js
var ABORT_SIGNAL_CONTEXT_KEY = Object.freeze({
  token: /* @__PURE__ */ Symbol("chord.abortSignal")
});
var BaseContext = class {
  get abortSignal() {
    return this.value(ABORT_SIGNAL_CONTEXT_KEY);
  }
};
var EmptyContext = class extends BaseContext {
  #name;
  constructor(name) {
    super();
    this.#name = name;
  }
  value(_key) {
    return void 0;
  }
  toString() {
    return this.#name;
  }
};
var BACKGROUND_CONTEXT = new EmptyContext("[Context BACKGROUND_CONTEXT]");
var TODO_CONTEXT = new EmptyContext("[Context TODO_CONTEXT]");

// node_modules/@earendil-works/chord/dist/api.js
function defineService(id, options) {
  if (id.length === 0)
    throw new TypeError("Service ID must not be empty");
  if (id.startsWith("$chord."))
    throw new TypeError("Service IDs beginning with $chord. are reserved");
  return Object.freeze({ id, local: options?.local ?? false });
}

// examples/desktop-extensions/portfolio-dashboards/contract.ts
var Dashboards = defineService(
  "pi-gui.example.portfolio-dashboards.v1"
);

// examples/desktop-extensions/portfolio-dashboards/desktop.ts
var SHARED_TOKENS = { "--r-sm": "6px", "--r-md": "10px", "--r-lg": "12px" };
var LIGHT_TOKENS = {
  ...SHARED_TOKENS,
  "--plane": "#f4f6f9",
  "--surface": "#ffffff",
  "--surface-2": "#f1f4f8",
  "--surface-sunk": "#e8edf3",
  "--ink": "#0d1b2a",
  "--ink-2": "#47566b",
  "--ink-muted": "#7a8899",
  "--hair": "#e3e8ef",
  "--hair-strong": "#c8d1dd",
  "--ring": "rgba(13,27,42,0.09)",
  "--series-1": "#2a78d6",
  "--series-2": "#94a3b8",
  "--series-3": "#0f3f7d",
  "--series-4": "#86b6ef",
  "--series-5": "#64748b",
  "--series-6": "#1c5cab",
  "--series-7": "#334155",
  "--series-8": "#b7d3f6",
  "--good": "#067647",
  "--warning": "#b54708",
  "--serious": "#b54708",
  "--critical": "#b42318",
  "--good-ink": "#067647",
  "--accent": "#103a72",
  "--accent-ink": "#ffffff",
  "--shadow": "0 1px 2px rgba(13,27,42,.05), 0 8px 24px rgba(13,27,42,.06)"
};
var DARK_TOKENS = {
  ...SHARED_TOKENS,
  "--plane": "#080c12",
  "--surface": "#111823",
  "--surface-2": "#18212e",
  "--surface-sunk": "#0c131c",
  "--ink": "#eef3f9",
  "--ink-2": "#aebbcc",
  "--ink-muted": "#7a8899",
  "--hair": "#212c3a",
  "--hair-strong": "#33445c",
  "--ring": "rgba(255,255,255,0.09)",
  "--series-1": "#4a90e2",
  "--series-2": "#b9c2ce",
  "--series-3": "#9ec5f4",
  "--series-4": "#256abf",
  "--series-5": "#64748b",
  "--series-6": "#6da7ec",
  "--series-7": "#cbd5e1",
  "--series-8": "#184f95",
  "--good": "#47cd89",
  "--warning": "#f79009",
  "--serious": "#f79009",
  "--critical": "#f97066",
  "--good-ink": "#47cd89",
  "--accent": "#4a90e2",
  "--accent-ink": "#08111c",
  "--shadow": "0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.45)"
};
var CSS = `
*{box-sizing:border-box} body{margin:0}
.dash{min-height:100vh;background:var(--plane);color:var(--ink);
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",Inter,sans-serif;-webkit-font-smoothing:antialiased;
  padding:26px 30px 60px}
.dash h1,.dash h2,.dash h3{margin:0;letter-spacing:-.02em;font-weight:600}
.dash h1{font-size:22px}.dash h2{font-size:16px}.dash h3{font-size:13.5px}
.page-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px}
.page-head p{margin:4px 0 0;color:var(--ink-2);font-size:13px;max-width:70ch}
.page-head .grow{flex:1;min-width:0}
.asof{font-size:11.5px;color:var(--ink-2);background:var(--surface-2);
  padding:4px 9px;border-radius:999px;border:1px solid var(--hair);white-space:nowrap}
.muted{color:var(--ink-muted)}
.workflows{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:18px}
.workflows .lab,.folderbar .lab{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-muted);margin-right:2px}
.folderbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px;
  padding-bottom:14px;border-bottom:1px solid var(--hair)}
.folder-path{font-size:11.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--hair);
  border-radius:6px;padding:3px 8px;max-width:44ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.folder-tag{font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-muted)}
.folder-input{flex:1;min-width:160px;font:inherit;font-size:12.5px;color:var(--ink);background:var(--surface);
  border:1px solid var(--hair-strong);border-radius:6px;padding:5px 9px}
.folder-input::placeholder{color:var(--ink-muted)}
.link-btn{font-size:12px;background:none;border:0;color:var(--accent);cursor:pointer;padding:4px 2px;font-family:inherit}
.link-btn:hover{text-decoration:underline}
.link-btn:disabled{opacity:.5;cursor:default;text-decoration:none}
.chip{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--hair);
  background:var(--surface-2);color:var(--ink-2);cursor:pointer;font-family:inherit}
.chip:hover{border-color:var(--hair-strong);color:var(--ink)}
.chip.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.chip:disabled{opacity:.5;cursor:default}
.error{color:var(--critical);white-space:pre-wrap;margin:0 0 14px;font-size:12.5px}
.grid{display:grid;gap:14px;margin-bottom:14px}
.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:980px){.g4{grid-template-columns:1fr 1fr}}
.stat{background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);padding:14px 16px;min-width:0}
.stat .k{font-size:11.5px;color:var(--ink-muted)}
.stat .v{font-size:25px;font-weight:600;letter-spacing:-.03em;margin-top:3px;line-height:1.15}
.stat .d{font-size:12px;margin-top:4px;display:flex;align-items:center;gap:5px}
.d.up{color:var(--good-ink)} .d.down{color:var(--critical)} .d.flat{color:var(--ink-muted)}
.card{background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);
  padding:16px 18px;min-width:0;margin-bottom:14px}
.card-head{display:flex;align-items:baseline;gap:10px;margin-bottom:2px}
.card-head .grow{flex:1;min-width:0}
.card-sub{font-size:12px;color:var(--ink-muted);margin:2px 0 14px}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:550;
  padding:3px 9px;border-radius:999px;border:1px solid var(--hair);background:var(--surface-2);color:var(--ink-2);white-space:nowrap}
.pill.good{color:var(--good-ink);border-color:color-mix(in srgb,var(--good) 35%,var(--hair));background:color-mix(in srgb,var(--good) 9%,var(--surface))}
.pill.warning{color:var(--ink);border-color:color-mix(in srgb,var(--warning) 45%,var(--hair));background:color-mix(in srgb,var(--warning) 14%,var(--surface))}
.pill.serious{color:var(--ink);border-color:color-mix(in srgb,var(--serious) 45%,var(--hair));background:color-mix(in srgb,var(--serious) 14%,var(--surface))}
.pill.critical{color:var(--critical);border-color:color-mix(in srgb,var(--critical) 35%,var(--hair));background:color-mix(in srgb,var(--critical) 9%,var(--surface))}
.pill .ic{font-size:10px}
table.tbl{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
table.tbl th{text-align:right;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  color:var(--ink-muted);padding:0 10px 8px;border-bottom:1px solid var(--hair);white-space:nowrap}
table.tbl th.left,table.tbl td.left{text-align:left}
table.tbl th:first-child,table.tbl td:first-child{padding-left:0}
table.tbl th:last-child,table.tbl td:last-child{padding-right:0}
table.tbl td{text-align:right;padding:8px 10px;border-bottom:1px solid var(--hair)}
table.tbl tr:last-child td{border-bottom:0}
.num-pos{color:var(--good-ink)} .num-neg{color:var(--critical)}
.cell-muted{color:var(--ink-muted)} .cell-strong{font-weight:550}
.chart{position:relative}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 10px;font-size:12px;color:var(--ink-2)}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.legend i.line{height:2px;border-radius:1px;width:14px;vertical-align:3px}
.tip{position:absolute;pointer-events:none;z-index:5;background:var(--surface);
  border:1px solid var(--hair-strong);border-radius:8px;box-shadow:var(--shadow);
  padding:8px 10px;font-size:12px;min-width:132px;opacity:0;transition:opacity .09s;font-variant-numeric:tabular-nums}
.tip.on{opacity:1}
.tip .th{font-weight:600;margin-bottom:5px;font-size:11.5px}
.tip .tr{display:flex;align-items:center;gap:7px;margin-top:2px;color:var(--ink-2)}
.tip .tr b{margin-left:auto;color:var(--ink);font-weight:600}
.tip i{width:8px;height:8px;border-radius:2px;display:inline-block;flex:none}
.axis-lab{font-size:10.5px;fill:var(--ink-muted)}
.grid-line{stroke:var(--hair);stroke-width:1}
.base-line{stroke:var(--hair-strong);stroke-width:1}
.prov{margin-top:12px;padding-top:10px;border-top:1px solid var(--hair);
  font-size:11px;color:var(--ink-muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.empty{border:1px dashed var(--hair-strong);border-radius:var(--r-lg);padding:28px;
  color:var(--ink-2);font-size:13px;max-width:60ch}
.empty b{color:var(--ink)}
`;
var FORMATTERS = {
  money: (v) => `$${v.toFixed(1)}M`,
  money0: (v) => `$${Math.round(v)}M`,
  int: (v) => Math.round(v).toLocaleString(),
  pct0: (v) => `${v.toFixed(0)}%`,
  pct1: (v) => `${v.toFixed(1)}%`,
  mult: (v) => `${v.toFixed(1)}x`,
  plain: (v) => String(v)
};
var fmt = (key, v) => v === null || v === void 0 ? "\u2014" : FORMATTERS[key ?? "money"](v);
var esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
var NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (value !== null && value !== void 0) node.setAttribute(key, String(value));
  }
  if (parent) parent.appendChild(node);
  return node;
}
function niceTicks(min, max, count) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function barPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0.5) return `M${x},${y + h}L${x + w},${y + h}`;
  return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
}
function ensureTip(host) {
  let tip = host.querySelector(".tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tip";
    host.appendChild(tip);
  }
  return tip;
}
function placeTip(host, tip, px, py) {
  const hostWidth = host.clientWidth;
  const tipWidth = tip.offsetWidth || 150;
  let x = px + 14;
  if (x + tipWidth > hostWidth - 4) x = px - tipWidth - 14;
  if (x < 0) x = 4;
  tip.style.left = `${x}px`;
  tip.style.top = `${Math.max(0, py - 16)}px`;
}
function tipRows(title, rows) {
  return `<div class="th">${esc(title)}</div>` + rows.map(
    (row) => `<div class="tr"><i style="background:${row.color}"></i>${esc(row.name)}<b>${esc(row.value)}</b></div>`
  ).join("");
}
function legend(host, series) {
  const parent = host.parentElement;
  if (!parent) return;
  parent.querySelector(".legend")?.remove();
  if (series.length < 2) return;
  const node = document.createElement("div");
  node.className = "legend";
  node.innerHTML = series.map(
    (entry) => `<span><i class="${entry.type === "line" ? "line" : ""}" style="${entry.dashed ? `background:none;border-top:2px dashed ${entry.color}` : `background:${entry.color}`}"></i>${esc(entry.name)}</span>`
  ).join("");
  parent.insertBefore(node, host);
}
function drawCartesian(host, spec, cssVar) {
  host.querySelectorAll("svg").forEach((svg2) => svg2.remove());
  const W = Math.max(280, host.clientWidth);
  const H = spec.height || 230;
  const m = { t: 10, r: 8, b: 26, l: 46 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const slotColor = (slot, fallback) => cssVar(`--series-${slot ?? fallback}`);
  const bars = spec.series.filter((entry) => entry.kind === "bar").map((entry, index) => ({
    ...entry,
    color: slotColor(entry.slot, index + 1),
    type: "bar"
  }));
  const lines = spec.series.filter((entry) => entry.kind === "line").map((entry, index) => ({
    ...entry,
    color: slotColor(entry.slot, bars.length + index + 1),
    type: "line"
  }));
  const all = [...bars, ...lines];
  const values = all.flatMap((entry) => entry.values).filter((v) => v !== null);
  if (values.length === 0) return;
  let lo = Math.min(...values);
  const hi = Math.max(...values);
  if (spec.yZero !== false) lo = Math.min(0, lo);
  else lo = lo - (hi - lo) * 0.25;
  const ticks = niceTicks(lo, hi, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const Y = (v) => m.t + ph - (v - yMin) / (yMax - yMin) * ph;
  const n = spec.cats.length;
  const band = pw / n;
  const X = (i) => m.l + band * i + band / 2;
  const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  host.insertBefore(svg, host.firstChild);
  for (const tick of ticks) {
    el(
      "line",
      {
        x1: m.l,
        x2: m.l + pw,
        y1: Y(tick),
        y2: Y(tick),
        class: tick === 0 ? "base-line" : "grid-line"
      },
      svg
    );
    const label = el(
      "text",
      { x: m.l - 8, y: Y(tick) + 3.5, "text-anchor": "end", class: "axis-lab" },
      svg
    );
    label.textContent = fmt(spec.format, tick).replace(".0M", "M").replace(".00M", "M");
  }
  const gap = 2;
  let groupW = band * 0.62;
  let bw = bars.length ? (groupW - gap * (bars.length - 1)) / bars.length : 0;
  if (bw > 26) {
    bw = 26;
    groupW = bw * bars.length + gap * (bars.length - 1);
  }
  bars.forEach((series, seriesIndex) => {
    series.values.forEach((v, i) => {
      if (v === null) return;
      const x = X(i) - groupW / 2 + seriesIndex * (bw + gap);
      const y = Y(Math.max(v, 0));
      const h = Math.abs(Y(v) - Y(0));
      el("path", { d: barPath(x, y, bw, h, 4), fill: series.color }, svg);
    });
  });
  for (const series of lines) {
    const pts = series.values.map((v, i) => v === null ? null : [X(i), Y(v)]);
    const solid = [];
    const dashed = [];
    pts.forEach((p, i) => {
      if (!p) return;
      (series.dashFrom !== void 0 && i >= series.dashFrom ? dashed : solid).push(p);
    });
    const beforeDash = series.dashFrom !== void 0 ? pts[series.dashFrom - 1] : null;
    if (beforeDash) dashed.unshift(beforeDash);
    const d = (points) => points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
    const base = {
      fill: "none",
      stroke: series.color,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    };
    if (solid.length)
      el("path", { ...base, d: d(solid), "stroke-dasharray": series.dashed ? "5 4" : null }, svg);
    if (dashed.length > 1) el("path", { ...base, d: d(dashed), "stroke-dasharray": "5 4" }, svg);
    for (const p of pts) {
      if (!p) continue;
      el(
        "circle",
        {
          cx: p[0],
          cy: p[1],
          r: series.dashed ? 3.5 : 4.5,
          fill: series.dashed ? cssVar("--surface") : series.color,
          stroke: series.color,
          "stroke-width": 2
        },
        svg
      );
    }
  }
  spec.cats.forEach((cat, i) => {
    const label = el(
      "text",
      { x: X(i), y: H - 8, "text-anchor": "middle", class: "axis-lab" },
      svg
    );
    label.textContent = cat;
  });
  const tip = ensureTip(host);
  const cross = el("line", { y1: m.t, y2: m.t + ph, class: "base-line", opacity: 0 }, svg);
  const hit = el("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent" }, svg);
  hit.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor((event.clientX - rect.left - m.l) / band)));
    cross.setAttribute("x1", String(X(i)));
    cross.setAttribute("x2", String(X(i)));
    cross.setAttribute("opacity", "0.55");
    tip.innerHTML = tipRows(
      spec.cats[i] ?? "",
      all.map((series) => ({
        name: series.name,
        color: series.color,
        value: fmt(spec.format, series.values[i])
      }))
    );
    tip.classList.add("on");
    placeTip(host, tip, X(i), event.clientY - rect.top);
  });
  hit.addEventListener("mouseleave", () => {
    tip.classList.remove("on");
    cross.setAttribute("opacity", "0");
  });
  legend(host, all);
}
function drawHBars(host, spec, cssVar) {
  host.querySelectorAll("svg").forEach((svg2) => svg2.remove());
  const W = Math.max(280, host.clientWidth);
  const rowH = 30;
  const labW = 150;
  const H = spec.rows.length * rowH + 22;
  const pw = W - labW - 60;
  const max = Math.max(...spec.rows.map((row) => row.value)) * 1.02 || 1;
  const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  host.insertBefore(svg, host.firstChild);
  const tip = ensureTip(host);
  spec.rows.forEach((row, i) => {
    const y = i * rowH + 6;
    const label = el("text", { x: 0, y: y + 13, class: "axis-lab" }, svg);
    label.textContent = row.label;
    label.setAttribute(
      "style",
      `font-size:11.5px;fill:${cssVar(row.emphasis ? "--ink" : "--ink-2")}`
    );
    const w = Math.max(2, row.value / max * pw);
    const color = cssVar(`--series-${row.slot ?? 1}`);
    const bar = el(
      "path",
      {
        d: `M${labW},${y + 3}L${labW + w - 4},${y + 3}Q${labW + w},${y + 3} ${labW + w},${y + 7}L${labW + w},${y + 13}Q${labW + w},${y + 17} ${labW + w - 4},${y + 17}L${labW},${y + 17}Z`,
        fill: color
      },
      svg
    );
    const valueLabel = el("text", { x: labW + w + 8, y: y + 14, class: "axis-lab" }, svg);
    valueLabel.textContent = fmt(spec.format, row.value);
    valueLabel.setAttribute("style", `font-size:11.5px;fill:${cssVar("--ink")}`);
    bar.addEventListener("mousemove", (event) => {
      const rect = svg.getBoundingClientRect();
      tip.innerHTML = tipRows(row.label, [
        { name: spec.seriesName ?? "Value", color, value: fmt(spec.format, row.value) }
      ]);
      tip.classList.add("on");
      placeTip(host, tip, event.clientX - rect.left, event.clientY - rect.top);
    });
    bar.addEventListener("mouseleave", () => tip.classList.remove("on"));
  });
}
var DELTA_ICON = { up: "\u25B2", down: "\u25BC", flat: "\u25CF" };
var PILL_ICON = { good: "\u2713", warning: "!", serious: "!", critical: "\u2715", neutral: "\u25CB" };
function statHtml(stat) {
  const delta = stat.delta ? `<div class="d ${stat.delta.tone}"><span>${DELTA_ICON[stat.delta.tone]}</span>${esc(stat.delta.text)}</div>` : "";
  return `<div class="stat"><div class="k">${esc(stat.label)}</div><div class="v">${esc(stat.value)}</div>${delta}</div>`;
}
function tableHtml(table) {
  const head = table.columns.map(
    (column) => `<th${column.align === "left" ? ' class="left"' : ""}>${esc(column.label)}</th>`
  ).join("");
  const body = table.rows.map(
    (row) => `<tr>${row.map((cellValue, index) => {
      const align = table.columns[index]?.align === "left" ? " left" : "";
      if (cellValue.pill) {
        return `<td class="${align.trim()}"><span class="pill ${cellValue.pill === "neutral" ? "" : cellValue.pill}"><span class="ic">${PILL_ICON[cellValue.pill]}</span>${esc(cellValue.text)}</span></td>`;
      }
      const tone = cellValue.tone === "pos" ? " num-pos" : cellValue.tone === "neg" ? " num-neg" : cellValue.tone === "muted" ? " cell-muted" : cellValue.tone === "strong" ? " cell-strong" : "";
      return `<td class="${(align + tone).trim()}">${esc(cellValue.text)}</td>`;
    }).join("")}</tr>`
  ).join("");
  return `<div class="card"><div class="card-head"><h3 class="grow">${esc(table.title)}</h3></div>${table.subtitle ? `<div class="card-sub">${esc(table.subtitle)}</div>` : ""}<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function chartCardHtml(chart, index) {
  return `<div class="card"><div class="card-head"><h3 class="grow">${esc(chart.title)}</h3></div>${chart.subtitle ? `<div class="card-sub">${esc(chart.subtitle)}</div>` : ""}<div class="chart" data-chart="${index}"></div></div>`;
}
async function mount(root, host) {
  host.signal.throwIfAborted();
  const style = document.createElement("style");
  style.textContent = CSS;
  const view = document.createElement("main");
  view.className = "dash";
  const tokens = host.theme.mode === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  for (const name of Object.keys(tokens)) view.style.setProperty(name, tokens[name]);
  root.replaceChildren(style, view);
  const cssVar = (name) => view.style.getPropertyValue(name).trim();
  let state = {
    ready: false,
    error: null,
    workingFolder: "",
    usingSampleData: true,
    workspaceFolder: null,
    workflows: [],
    dashboards: []
  };
  let selected = null;
  let actionError = "";
  let pending = false;
  let disposed = false;
  let folderDraft = "";
  const mountCharts = (record) => {
    if (!record) return;
    view.querySelectorAll(".chart[data-chart]").forEach((chartHost) => {
      const chart = record.spec.charts[Number(chartHost.dataset.chart)];
      if (!chart) return;
      if (chart.kind === "hbars") drawHBars(chartHost, chart, cssVar);
      else drawCartesian(chartHost, chart, cssVar);
    });
  };
  const render = () => {
    if (disposed) return;
    const record = state.dashboards.find((candidate) => candidate.id === selected) ?? state.dashboards.at(-1);
    const workflows = state.workflows.map(
      (workflow) => `<button class="chip" data-workflow="${esc(workflow.id)}" title="${esc(
        `${workflow.description} (reads ${workflow.dataset})`
      )}" ${pending ? "disabled" : ""}>${esc(workflow.label)}</button>`
    ).join("");
    const workspaceButton = state.workspaceFolder && state.workspaceFolder !== state.workingFolder ? `<button class="link-btn" data-usews ${pending ? "disabled" : ""}>Use workspace folder</button>` : "";
    const sampleButton = state.usingSampleData ? "" : `<button class="link-btn" data-usesample ${pending ? "disabled" : ""}>Use sample data</button>`;
    const folderBar = `<div class="folderbar">
      <span class="lab">Working folder</span>
      <code class="folder-path" title="${esc(state.workingFolder)}">${esc(state.workingFolder)}</code>
      ${state.usingSampleData ? '<span class="folder-tag">sample data</span>' : ""}
      <input class="folder-input" type="text" placeholder="Paste an absolute folder path\u2026" ${pending ? "disabled" : ""} />
      <button class="chip" data-setfolder ${pending ? "disabled" : ""}>Set</button>
      ${workspaceButton}${sampleButton}
    </div>`;
    const history = state.dashboards.map(
      (candidate) => `<button class="chip ${candidate.id === record?.id ? "on" : ""}" data-select="${esc(candidate.id)}">${esc(candidate.spec.title)}</button>`
    ).join("");
    const errors = [state.error, actionError].filter(Boolean).join("\n");
    const bodyHtml = record ? `<div class="page-head"><div class="grow"><h1>${esc(record.spec.title)}</h1>${record.spec.subtitle ? `<p>${esc(record.spec.subtitle)}</p>` : ""}</div>${record.spec.asOf ? `<span class="asof">${esc(record.spec.asOf)}</span>` : ""}</div>
        ${record.spec.stats.length ? `<div class="grid g4">${record.spec.stats.map(statHtml).join("")}</div>` : ""}
        ${record.spec.charts.map(chartCardHtml).join("")}
        ${record.spec.tables.map(tableHtml).join("")}
        <div class="prov">${esc(record.spec.source ?? "emitted dashboard")} \xB7 ${esc(
      record.origin === "workflow" ? "pre-configured workflow" : "emit_dashboard tool"
    )} \xB7 ${esc(new Date(record.createdAt).toLocaleTimeString())}</div>` : `<div class="empty"><b>No dashboards yet.</b><br>Pick a working folder, then run a workflow
         above (each computes from its data file), type /dashboard in the composer, or ask the agent
         to publish data with the emit_dashboard tool.</div>`;
    view.innerHTML = `
      ${folderBar}
      <div class="workflows"><span class="lab">Workflows</span>${workflows}</div>
      ${state.dashboards.length > 1 ? `<div class="workflows"><span class="lab">History</span>${history}</div>` : ""}
      ${errors ? `<p class="error" role="alert">${esc(errors)}</p>` : ""}
      ${bodyHtml}`;
    const input = view.querySelector(".folder-input");
    if (input) input.value = folderDraft;
    mountCharts(record);
  };
  const showError = (reason) => {
    actionError = reason instanceof Error ? reason.message : String(reason);
    render();
  };
  const binding = host.services.open({
    services: [Dashboards],
    assertAccess: () => host.signal.throwIfAborted(),
    onError: showError
  });
  const service = binding.use(Dashboards);
  const perform = (action) => {
    if (pending || disposed) return;
    pending = true;
    actionError = "";
    render();
    action().catch((reason) => {
      actionError = reason instanceof Error ? reason.message : String(reason);
    }).finally(() => {
      pending = false;
      render();
    });
  };
  view.addEventListener("input", (event) => {
    const input = event.target.closest(".folder-input");
    if (input) folderDraft = input.value;
  });
  view.addEventListener("click", (event) => {
    const target = event.target.closest(
      "[data-workflow],[data-select],[data-setfolder],[data-usews],[data-usesample]"
    );
    if (!target || pending || disposed) return;
    if (target.dataset.select !== void 0) {
      selected = target.dataset.select;
      render();
      return;
    }
    if (target.dataset.setfolder !== void 0) {
      const folder = folderDraft.trim();
      if (folder === "") return;
      perform(async () => {
        await service.setWorkingFolder({ folder }, BACKGROUND_CONTEXT);
        folderDraft = "";
      });
      return;
    }
    if (target.dataset.usews !== void 0) {
      const folder = state.workspaceFolder;
      if (folder) perform(() => service.setWorkingFolder({ folder }, BACKGROUND_CONTEXT));
      return;
    }
    if (target.dataset.usesample !== void 0) {
      perform(() => service.setWorkingFolder({ folder: null }, BACKGROUND_CONTEXT));
      return;
    }
    const workflowId = target.dataset.workflow;
    const requestId = [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    perform(async () => {
      const result = await service.emitWorkflow({ workflowId, requestId }, BACKGROUND_CONTEXT);
      selected = result.dashboardId;
    });
  });
  let resizeTimer;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const record = state.dashboards.find((candidate) => candidate.id === selected) ?? state.dashboards.at(-1);
      mountCharts(record);
    }, 120);
  });
  observer.observe(view);
  let unsubscribe = () => {
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    clearTimeout(resizeTimer);
    unsubscribe();
    host.signal.removeEventListener("abort", dispose);
    binding.dispose(BACKGROUND_CONTEXT).catch(() => {
    });
    root.replaceChildren();
  };
  host.signal.addEventListener("abort", dispose, { once: true });
  render();
  try {
    await binding.ready(BACKGROUND_CONTEXT);
    host.signal.throwIfAborted();
    unsubscribe = service.state.subscribe((next) => {
      const lastId = state.dashboards.at(-1)?.id;
      state = next;
      if (next.dashboards.at(-1)?.id !== lastId) selected = next.dashboards.at(-1)?.id ?? null;
      render();
    });
    if (service.state.value) state = service.state.value;
    selected = state.dashboards.at(-1)?.id ?? null;
    render();
  } catch (reason) {
    dispose();
    throw reason;
  }
  return dispose;
}
export {
  mount
};
