/*
 * Brain report contract — pure and shared between the main process (which runs
 * the workflow prompt through the model) and the renderer (which renders the
 * result). No filesystem or Node access here.
 *
 * Portfolio and Deals are workflows: a preset prompt asks the model to inspect
 * the working folder and return the raw facts as JSON. The derived numbers
 * (variances, stats, stage/status) are computed deterministically here, so the
 * model only supplies data it can find — not arithmetic.
 */

export type BrainReportKind = "portfolio" | "deals";

export const DEAL_STAGES = ["Screen", "IOI", "Diligence", "Exclusivity", "Sign"] as const;

export interface BrainStat {
  readonly label: string;
  readonly value: string;
}

export interface BrainCompany {
  readonly tag: string;
  readonly name: string;
  readonly sector: string;
  readonly held: string;
  readonly revenue: number;
  readonly revVsBudget: number | null;
  readonly ebitda: number;
  readonly ebitdaVsBudget: number | null;
  readonly evMultiple: number;
  readonly moic: number;
  readonly irr: number;
}

export interface BrainFund {
  readonly name: string;
  readonly revenue: number;
  readonly ebitda: number;
  readonly companies: readonly BrainCompany[];
}

export interface BrainPortfolio {
  readonly stats: readonly BrainStat[];
  readonly funds: readonly BrainFund[];
}

export type BrainDealTone = "good" | "warning" | "serious";

export interface BrainDeal {
  readonly tag: string;
  readonly name: string;
  readonly sector: string;
  readonly ev: number;
  readonly entryMultiple: number;
  readonly equityCheque: number;
  readonly stageIndex: number;
  readonly status: string;
  readonly statusTone: BrainDealTone;
}

export interface BrainDeals {
  readonly stats: readonly BrainStat[];
  readonly deals: readonly BrainDeal[];
}

export interface BrainFolderState {
  /** The chosen override folder, or null when following the workspace folder. */
  readonly chosenFolder: string | null;
}

export interface BrainModelSelection {
  readonly provider: string;
  readonly modelId: string;
}

export interface BrainTraceStep {
  readonly label: string;
  readonly detail?: string;
}

export interface BrainComputeResult {
  readonly kind: BrainReportKind;
  /** The working folder the workflow analysed, or null if none is set. */
  readonly folder: string | null;
  /** True when the folder is an explicit choice rather than the workspace. */
  readonly chosen: boolean;
  /** ISO timestamp the workflow last produced this result. */
  readonly ranAt?: string;
  /** The model that produced the result, e.g. "portalgun/claude-sonnet-5". */
  readonly model?: string;
  /** The steps the workflow took, shown as its trace. */
  readonly trace?: readonly BrainTraceStep[];
  readonly portfolio?: BrainPortfolio;
  readonly deals?: BrainDeals;
  /** A human-readable reason the workflow could not produce a result. */
  readonly error?: string;
}

/* ------------------------------------------------------------ workflow prompts */
export const BRAIN_SYSTEM_PROMPT = [
  "You are a private-equity analyst assistant embedded in a desktop app.",
  "You produce structured data for a dashboard from whatever source material you are given.",
  "Respond with a single JSON object and nothing else — no prose, no markdown fences.",
  "Use numbers (not strings) for all numeric fields. Omit a field only if the schema allows it.",
  "If the material does not contain the figures, produce a plausible, clearly-fictional set so the",
  "dashboard renders, and keep it internally consistent.",
].join("\n");

export function buildBrainPrompt(kind: BrainReportKind, folderSnapshot: string): string {
  const schema =
    kind === "portfolio"
      ? [
          "Return this JSON shape:",
          "{",
          '  "companies": [',
          "    {",
          '      "fund": string,            // fund/vehicle name to group by',
          '      "name": string,',
          '      "sector": string,',
          '      "held": string,            // e.g. "held since 2022" (may be empty)',
          '      "ltmRevenue": number,      // $M',
          '      "revenueBudget": number,   // $M, budget for LTM revenue',
          '      "ltmEbitda": number,       // $M',
          '      "ebitdaBudget": number,    // $M, budget for LTM EBITDA',
          '      "evMultiple": number,      // EV / LTM EBITDA',
          '      "moic": number,',
          '      "irr": number              // percent',
          "    }",
          "  ]",
          "}",
        ].join("\n")
      : [
          "Return this JSON shape:",
          "{",
          '  "deals": [',
          "    {",
          '      "name": string,',
          '      "sector": string,',
          '      "ev": number,              // enterprise value, $M',
          '      "entryMultiple": number,   // EV / EBITDA at entry',
          '      "equityCheque": number,    // $M',
          `      "stage": string,           // one of: ${DEAL_STAGES.join(", ")}`,
          '      "status": string           // e.g. "On track", "Watching", "Repricing"',
          "    }",
          "  ]",
          "}",
        ].join("\n");
  const task =
    kind === "portfolio"
      ? "Build the portfolio holdings report."
      : "Build the active deal pipeline report.";
  return [
    task,
    "",
    "Working folder contents follow. Use them if relevant; otherwise produce fictional demo data.",
    "<folder>",
    folderSnapshot || "(the folder is empty or has no readable data files)",
    "</folder>",
    "",
    schema,
  ].join("\n");
}

/* ---------------------------------------------------------------- JSON parsing */
/** Pulls the first balanced JSON object out of a model reply. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("The model did not return a JSON object.");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("The model returned an incomplete JSON object.");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`The model output is missing a non-empty "${field}" array.`);
  }
  return value;
}

function toNumber(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value.replace(/[$,%\s]/g, "")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`Field "${field}" must be a number.`);
  }
  return n;
}

function toStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const variance = (actual: number, reference: number): number | null =>
  reference === 0 ? null : ((actual - reference) / Math.abs(reference)) * 100;
const money0 = (value: number) => `$${Math.round(value)}M`;
const initials = (name: string): string =>
  name
    .replace(/^Project\s+/i, "")
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function parseBrainPortfolio(value: unknown): BrainPortfolio {
  if (!isRecord(value)) throw new Error("The model output must be a JSON object.");
  const rows = requireArray(value.companies, "companies");
  const fundOrder: string[] = [];
  const byFund = new Map<string, BrainCompany[]>();
  rows.forEach((row, index) => {
    if (!isRecord(row)) throw new Error(`companies[${index}] must be an object.`);
    const fund = toStr(row.fund) || "Portfolio";
    if (!byFund.has(fund)) {
      byFund.set(fund, []);
      fundOrder.push(fund);
    }
    const revenue = toNumber(row.ltmRevenue, `companies[${index}].ltmRevenue`);
    const ebitda = toNumber(row.ltmEbitda, `companies[${index}].ltmEbitda`);
    byFund.get(fund)!.push({
      tag: initials(toStr(row.name)),
      name: toStr(row.name) || "Untitled",
      sector: toStr(row.sector),
      held: toStr(row.held),
      revenue,
      revVsBudget: variance(
        revenue,
        toNumber(row.revenueBudget, `companies[${index}].revenueBudget`),
      ),
      ebitda,
      ebitdaVsBudget: variance(
        ebitda,
        toNumber(row.ebitdaBudget, `companies[${index}].ebitdaBudget`),
      ),
      evMultiple: toNumber(row.evMultiple, `companies[${index}].evMultiple`),
      moic: toNumber(row.moic, `companies[${index}].moic`),
      irr: toNumber(row.irr, `companies[${index}].irr`),
    });
  });
  const funds: BrainFund[] = fundOrder.map((name) => {
    const companies = byFund.get(name)!;
    return {
      name,
      revenue: companies.reduce((sum, c) => sum + c.revenue, 0),
      ebitda: companies.reduce((sum, c) => sum + c.ebitda, 0),
      companies,
    };
  });
  const all = funds.flatMap((fund) => fund.companies);
  const stats: BrainStat[] = [
    { label: "Positions", value: String(all.length) },
    { label: "LTM revenue", value: money0(all.reduce((sum, c) => sum + c.revenue, 0)) },
    { label: "LTM EBITDA", value: money0(all.reduce((sum, c) => sum + c.ebitda, 0)) },
    {
      label: "Top MOIC",
      value: `${all.reduce((best, c) => Math.max(best, c.moic), 0).toFixed(1)}x`,
    },
  ];
  return { stats, funds };
}

function stageIndexOf(stage: string): number {
  const index = DEAL_STAGES.findIndex((name) => name.toLowerCase() === stage.trim().toLowerCase());
  return index < 0 ? 0 : index;
}

function dealTone(status: string): BrainDealTone {
  const normalized = status.trim().toLowerCase();
  if (/(on track|signed|cleared|complete)/.test(normalized)) return "good";
  if (/(reprice|repricing|at risk|stalled|blocked)/.test(normalized)) return "serious";
  return "warning";
}

export function parseBrainDeals(value: unknown): BrainDeals {
  if (!isRecord(value)) throw new Error("The model output must be a JSON object.");
  const rows = requireArray(value.deals, "deals");
  const deals: BrainDeal[] = rows.map((row, index) => {
    if (!isRecord(row)) throw new Error(`deals[${index}] must be an object.`);
    return {
      tag: initials(toStr(row.name)),
      name: toStr(row.name) || "Untitled",
      sector: toStr(row.sector),
      ev: toNumber(row.ev, `deals[${index}].ev`),
      entryMultiple: toNumber(row.entryMultiple, `deals[${index}].entryMultiple`),
      equityCheque: toNumber(row.equityCheque, `deals[${index}].equityCheque`),
      stageIndex: stageIndexOf(toStr(row.stage)),
      status: toStr(row.status) || "Active",
      statusTone: dealTone(toStr(row.status)),
    };
  });
  const combined = deals.reduce((sum, deal) => sum + deal.ev, 0);
  const multiples = deals.map((deal) => deal.entryMultiple).sort((a, b) => a - b);
  const median = multiples.length === 0 ? 0 : multiples[Math.floor(multiples.length / 2)]!;
  const stats: BrainStat[] = [
    { label: "Active deals", value: String(deals.length) },
    { label: "Combined EV", value: money0(combined) },
    { label: "In exclusivity", value: String(deals.filter((deal) => deal.stageIndex >= 3).length) },
    { label: "Median entry", value: `${median.toFixed(1)}x` },
  ];
  return { stats, deals };
}

export { money0 };
