/*
 * Representative demo data for the Portfolio, Deals and Agents pages. All
 * figures are fictional — these pages reproduce the True Wind prototype's own
 * layouts. Live, computed dashboards come from the Portfolio Dashboards
 * extension (which reads a working folder); these pages are the app's own
 * curated sections.
 */

export interface PortfolioCompany {
  readonly tag: string;
  readonly name: string;
  readonly sector: string;
  readonly held: string;
  readonly revenue: number;
  readonly revVsBudget: number;
  readonly ebitda: number;
  readonly ebitdaVsBudget: number;
  readonly evMultiple: number;
  readonly moic: number;
  readonly irr: number;
}

export interface PortfolioFund {
  readonly name: string;
  readonly vintage: string;
  readonly companies: readonly PortfolioCompany[];
}

export const PORTFOLIO_FUNDS: readonly PortfolioFund[] = [
  {
    name: "Fund II",
    vintage: "2021 vintage",
    companies: [
      {
        tag: "MH",
        name: "Meridian Health",
        sector: "Healthcare services",
        held: "held since 2022",
        revenue: 148.2,
        revVsBudget: 2.4,
        ebitda: 32.4,
        ebitdaVsBudget: 3.1,
        evMultiple: 11.8,
        moic: 2.4,
        irr: 24.6,
      },
      {
        tag: "CS",
        name: "Cobalt Software",
        sector: "Vertical SaaS",
        held: "held since 2021",
        revenue: 84.3,
        revVsBudget: 4.1,
        ebitda: 27.1,
        ebitdaVsBudget: 6.8,
        evMultiple: 13.2,
        moic: 2.9,
        irr: 31.2,
      },
      {
        tag: "AC",
        name: "Atlas Compliance",
        sector: "Reg-tech",
        held: "held since 2023",
        revenue: 55.0,
        revVsBudget: 1.2,
        ebitda: 16.6,
        ebitdaVsBudget: 1.9,
        evMultiple: 12.1,
        moic: 1.6,
        irr: 18.4,
      },
    ],
  },
  {
    name: "Fund I",
    vintage: "2018 vintage",
    companies: [
      {
        tag: "NL",
        name: "Northgate Logistics",
        sector: "Supply chain",
        held: "held since 2019",
        revenue: 96.7,
        revVsBudget: -3.6,
        ebitda: 18.9,
        ebitdaVsBudget: -4.6,
        evMultiple: 9.4,
        moic: 1.9,
        irr: 12.8,
      },
      {
        tag: "HF",
        name: "Harbourline Foods",
        sector: "Consumer",
        held: "held since 2018",
        revenue: 71.5,
        revVsBudget: -6.1,
        ebitda: 11.2,
        ebitdaVsBudget: -8.9,
        evMultiple: 8.1,
        moic: 1.2,
        irr: 4.3,
      },
    ],
  },
];

export type DealStatusTone = "good" | "warning" | "serious";

export interface Deal {
  readonly tag: string;
  readonly name: string;
  readonly sector: string;
  readonly ev: number;
  readonly entryMultiple: number;
  readonly equityCheque: number;
  readonly stageIndex: number;
  readonly status: string;
  readonly statusTone: DealStatusTone;
}

export const DEAL_STAGES = ["Screen", "IOI", "Diligence", "Exclusivity", "Sign"] as const;

export const DEALS: readonly Deal[] = [
  {
    tag: "PA",
    name: "Project Palmyra",
    sector: "Property management roll-up",
    ev: 420,
    entryMultiple: 11.6,
    equityCheque: 168,
    stageIndex: 3,
    status: "On track",
    statusTone: "good",
  },
  {
    tag: "NW",
    name: "Project Northwind",
    sector: "Industrial services",
    ev: 310,
    entryMultiple: 10.2,
    equityCheque: 140,
    stageIndex: 1,
    status: "Watching",
    statusTone: "warning",
  },
  {
    tag: "CF",
    name: "Project Copperfield",
    sector: "Healthcare IT",
    ev: 265,
    entryMultiple: 12.8,
    equityCheque: 120,
    stageIndex: 2,
    status: "On track",
    statusTone: "good",
  },
  {
    tag: "SB",
    name: "Project Seabright",
    sector: "Marine logistics",
    ev: 190,
    entryMultiple: 9.1,
    equityCheque: 95,
    stageIndex: 0,
    status: "Early",
    statusTone: "warning",
  },
  {
    tag: "KE",
    name: "Project Kestrel",
    sector: "Aerospace parts",
    ev: 145,
    entryMultiple: 8.4,
    equityCheque: 70,
    stageIndex: 0,
    status: "Repricing",
    statusTone: "serious",
  },
];

export type AgentStatusTone = "good" | "warning";

export interface AgentRun {
  readonly name: string;
  readonly kind: string;
  readonly lastRun: string;
  readonly detail: string;
  readonly status: string;
  readonly statusTone: AgentStatusTone;
}

export const AGENTS: readonly AgentRun[] = [
  {
    name: "Research agent",
    kind: "On demand",
    lastRun: "ran 3h ago",
    detail: "Capability matrix across 6 competitors from interview transcripts.",
    status: "Idle",
    statusTone: "good",
  },
  {
    name: "Modelling agent",
    kind: "On demand",
    lastRun: "ran 3h ago",
    detail: "LBO from the FY26E operating case and adjusted LTM EBITDA.",
    status: "Idle",
    statusTone: "good",
  },
  {
    name: "Deck agent",
    kind: "On demand",
    lastRun: "ran 2h ago",
    detail: "32-slide IC deck on the house template, every figure sourced.",
    status: "Idle",
    statusTone: "good",
  },
  {
    name: "Dependency watch",
    kind: "Weekly · Mondays 08:00",
    lastRun: "next run in 2 days",
    detail: "Re-checks portfolio covenant headroom against the latest marks.",
    status: "Scheduled",
    statusTone: "warning",
  },
];
