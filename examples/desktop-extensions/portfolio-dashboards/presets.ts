import type { DashboardSpec, PresetInfo, TableCell } from "./contract.ts";

/*
 * Pre-configured workflows. Each preset deterministically builds one dashboard
 * spec from fictional demo data, in the True Wind reporting conventions: blue
 * carries the subject, grey the reference it is measured against, and status
 * colours always ship with an icon or label.
 */

const cell = (text: string, tone?: TableCell["tone"]): TableCell =>
  tone ? { text, tone } : { text };

const money0 = (v: number) => `$${Math.round(v)}M`;
const money1 = (v: number) => `$${v.toFixed(1)}M`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
const signedPct = (v: number) => `${signed(v)}%`;
// The suffix carries the unit ("% vs budget", " pts vs hurdle"), so the
// number itself is unsigned of any unit.
const deltaOf = (
  v: number,
  suffix = "% vs budget",
): { text: string; tone: "up" | "down" | "flat" } => ({
  text: `${signed(v)}${suffix}`,
  tone: Math.abs(v) < 0.5 ? "flat" : v >= 0 ? "up" : "down",
});

function portfolioOverview(): DashboardSpec {
  const quarters = ["Q1", "Q2", "Q3", "Q4", "Q1'27E", "Q2'27E"];
  const nav = [612, 648, 671, 705, null, null];
  const plan = [605, 634, 668, 694, 726, 758];
  const companies: [string, number, number, number, "good" | "warning" | "serious"][] = [
    ["Meridian Health", 148.2, 32.4, 3.1, "good"],
    ["Northgate Logistics", 96.7, 18.9, -4.6, "warning"],
    ["Cobalt Software", 84.3, 27.1, 6.8, "good"],
    ["Harbourline Foods", 71.5, 11.2, -8.9, "serious"],
    ["Atlas Compliance", 55.0, 16.6, 1.9, "good"],
  ];
  return {
    title: "Portfolio overview",
    subtitle: "Fund II mark against the operating plan, with each company against its budget.",
    asOf: "Corpus current to Jun 2026",
    source: "workflow: portfolio-overview · all figures fictional demo data",
    stats: [
      { label: "Fund NAV", value: money0(705), delta: deltaOf(1.6, "% vs plan") },
      { label: "Net IRR", value: "19.4%", delta: deltaOf(1.4, " pts vs hurdle") },
      { label: "Gross MOIC", value: "2.1x", delta: { text: "● unchanged", tone: "flat" } },
      { label: "Dry powder", value: money0(182), delta: deltaOf(-7.2, "% QoQ") },
    ],
    charts: [
      {
        kind: "cartesian",
        title: "NAV against plan, $M",
        subtitle: "Marks are quarterly; the dashed segment is the plan beyond the last mark.",
        cats: quarters,
        series: [
          { name: "NAV", kind: "bar", values: nav, slot: 1 },
          { name: "Operating plan", kind: "line", values: plan, slot: 2, dashed: true },
        ],
        format: "money0",
      },
    ],
    tables: [
      {
        title: "Portfolio companies",
        subtitle: "LTM revenue and EBITDA, variance measured against each company's budget.",
        columns: [
          { label: "Company", align: "left" },
          { label: "LTM revenue", align: "right" },
          { label: "LTM EBITDA", align: "right" },
          { label: "vs budget", align: "right" },
          { label: "Status", align: "right" },
        ],
        rows: companies.map(([name, revenue, ebitda, variance, tone]) => [
          cell(name, "strong"),
          cell(money1(revenue)),
          cell(money1(ebitda)),
          cell(signedPct(variance), variance >= 0 ? "pos" : "neg"),
          {
            text: tone === "good" ? "On track" : tone === "warning" ? "Watching" : "At risk",
            pill: tone,
          },
        ]),
      },
    ],
  };
}

function revenueVsBudget(): DashboardSpec {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const actual = [11.8, 12.1, 12.9, 12.4, 13.2, 13.8];
  const budget = [11.5, 11.9, 12.3, 12.7, 13.1, 13.5];
  const segments: [string, number, number][] = [
    ["Enterprise subscriptions", 8.4, 4.2],
    ["Mid-market subscriptions", 3.1, 1.1],
    ["Professional services", 1.6, -6.3],
    ["Marketplace and other", 0.7, 12.5],
  ];
  return {
    title: "Revenue vs budget — Cobalt Software",
    subtitle: "Monthly revenue against the board budget, split by segment.",
    asOf: "Close through Jun 2026",
    source: "workflow: revenue-vs-budget · all figures fictional demo data",
    stats: [
      { label: "LTM revenue", value: money1(84.3), delta: deltaOf(4.1) },
      { label: "June revenue", value: money1(13.8), delta: deltaOf(2.2) },
      { label: "Gross margin", value: "71.4%", delta: deltaOf(0.3, " pts vs budget") },
      { label: "Net revenue retention", value: "114%", delta: deltaOf(-1.8, " pts QoQ") },
    ],
    charts: [
      {
        kind: "cartesian",
        title: "Monthly revenue against budget, $M",
        cats: months,
        series: [
          { name: "Actual", kind: "bar", values: actual, slot: 1 },
          { name: "Budget", kind: "line", values: budget, slot: 2, dashed: true },
        ],
        format: "money",
        yZero: true,
      },
    ],
    tables: [
      {
        title: "June revenue by segment",
        columns: [
          { label: "Segment", align: "left" },
          { label: "Revenue", align: "right" },
          { label: "vs budget", align: "right" },
        ],
        rows: segments.map(([name, revenue, variance]) => [
          cell(name, "strong"),
          cell(money1(revenue)),
          cell(signedPct(variance), variance >= 0 ? "pos" : "neg"),
        ]),
      },
    ],
  };
}

function dealPipeline(): DashboardSpec {
  const deals: [string, number, string, "good" | "warning" | "neutral"][] = [
    ["Project Palmyra", 420, "Exclusivity", "good"],
    ["Project Northwind", 310, "IOI submitted", "warning"],
    ["Project Copperfield", 265, "Management meetings", "neutral"],
    ["Project Seabright", 190, "Initial review", "neutral"],
    ["Project Kestrel", 145, "Initial review", "neutral"],
  ];
  return {
    title: "Deal pipeline",
    subtitle: "Active opportunities by enterprise value and stage.",
    asOf: "Pipeline reviewed this week",
    source: "workflow: deal-pipeline · all figures fictional demo data",
    stats: [
      { label: "Active deals", value: "5", delta: deltaOf(25.0, "% QoQ") },
      { label: "In exclusivity", value: "1", delta: { text: "● unchanged", tone: "flat" } },
      { label: "Combined EV", value: money0(1330) },
      { label: "Median entry multiple", value: "11.2x", delta: deltaOf(-3.4, "% vs LTM avg") },
    ],
    charts: [
      {
        kind: "hbars",
        title: "Enterprise value by deal, $M",
        rows: deals.map(([label, value], index) => ({
          label,
          value,
          emphasis: index === 0,
          slot: index === 0 ? 3 : 1,
        })),
        format: "money0",
        seriesName: "Enterprise value",
      },
    ],
    tables: [
      {
        title: "Stage and next step",
        columns: [
          { label: "Deal", align: "left" },
          { label: "EV", align: "right" },
          { label: "Stage", align: "right" },
          { label: "Status", align: "right" },
        ],
        rows: deals.map(([name, ev, stage, tone]) => [
          cell(name, "strong"),
          cell(money0(ev)),
          cell(stage, "muted"),
          {
            text: tone === "good" ? "On track" : tone === "warning" ? "Watching" : "Queued",
            pill: tone,
          },
        ]),
      },
    ],
  };
}

export const presetBuilders: Record<string, () => DashboardSpec> = {
  portfolio: portfolioOverview,
  revenue: revenueVsBudget,
  pipeline: dealPipeline,
};

export const presetInfos: PresetInfo[] = [
  {
    id: "portfolio",
    label: "Portfolio overview",
    description: "Fund NAV against plan plus every company against its budget.",
  },
  {
    id: "revenue",
    label: "Revenue vs budget",
    description: "One company's monthly revenue, margin and retention against budget.",
  },
  {
    id: "pipeline",
    label: "Deal pipeline",
    description: "Active deals ranked by enterprise value with stage and status.",
  },
];
