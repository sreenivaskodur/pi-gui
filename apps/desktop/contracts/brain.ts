/*
 * Brain report compute — pure and shared between the main process (which reads
 * the CSV files from the working folder) and the renderer (which renders the
 * result). No filesystem or Node access here, so both sides can import it.
 *
 * Portfolio reads companies.csv, Deals reads pipeline.csv. Change the CSV in
 * the working folder and the page recomputes.
 */

export type BrainReportKind = "portfolio" | "deals";

export const BRAIN_DATASETS: Record<BrainReportKind, string> = {
  portfolio: "companies.csv",
  deals: "pipeline.csv",
};

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

export interface BrainComputeResult {
  readonly kind: BrainReportKind;
  readonly dataset: string;
  /** The working folder resolved for this compute, or null if none is set. */
  readonly folder: string | null;
  /** True when the folder is an explicit choice rather than the workspace. */
  readonly chosen: boolean;
  /** Absolute path of the file read, when the compute succeeded. */
  readonly computedFrom?: string;
  readonly rows?: number;
  readonly portfolio?: BrainPortfolio;
  readonly deals?: BrainDeals;
  /** A human-readable reason the report could not be computed. */
  readonly error?: string;
}

/* ------------------------------------------------------------- CSV parsing */
export interface DataTable {
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, string>[];
}

/** A small RFC-4180-ish CSV parser: quoted fields, commas and newlines. */
export function parseCsv(text: string): DataTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  if (rows.length === 0) return { columns: [], rows: [] };
  const columns = rows[0]!.map((name) => name.trim());
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    columns.forEach((name, index) => {
      record[name] = (cells[index] ?? "").trim();
    });
    return record;
  });
  return { columns, rows: records };
}

function requireColumns(table: DataTable, columns: readonly string[], dataset: string): void {
  const missing = columns.filter((column) => !table.columns.includes(column));
  if (missing.length > 0) {
    throw new Error(`${dataset} is missing column(s): ${missing.join(", ")}.`);
  }
}

function num(record: Record<string, string>, column: string, dataset: string): number {
  const raw = record[column] ?? "";
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/[−–]/g, "-");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new Error(`Value "${raw}" in ${dataset} column "${column}" is not a number.`);
  }
  return value;
}

const variance = (actual: number, reference: number): number | null =>
  reference === 0 ? null : ((actual - reference) / Math.abs(reference)) * 100;
const money = (value: number) => `$${value.toFixed(1)}M`;
const money0 = (value: number) => `$${Math.round(value)}M`;
const initials = (name: string): string =>
  name
    .replace(/^Project\s+/i, "")
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ------------------------------------------------------------- portfolio */
const PORTFOLIO_COLUMNS = [
  "fund",
  "company",
  "sector",
  "held",
  "ltm_revenue",
  "rev_budget",
  "ltm_ebitda",
  "ebitda_budget",
  "ev_multiple",
  "moic",
  "irr",
] as const;

export function computePortfolio(text: string): BrainPortfolio {
  const dataset = BRAIN_DATASETS.portfolio;
  const table = parseCsv(text);
  if (table.rows.length === 0) throw new Error(`${dataset} has no data rows.`);
  requireColumns(table, PORTFOLIO_COLUMNS, dataset);

  const fundOrder: string[] = [];
  const byFund = new Map<string, BrainCompany[]>();
  for (const record of table.rows) {
    const fund = record.fund || "Unassigned";
    if (!byFund.has(fund)) {
      byFund.set(fund, []);
      fundOrder.push(fund);
    }
    const revenue = num(record, "ltm_revenue", dataset);
    const ebitda = num(record, "ltm_ebitda", dataset);
    byFund.get(fund)!.push({
      tag: initials(record.company ?? ""),
      name: record.company ?? "",
      sector: record.sector ?? "",
      held: record.held ?? "",
      revenue,
      revVsBudget: variance(revenue, num(record, "rev_budget", dataset)),
      ebitda,
      ebitdaVsBudget: variance(ebitda, num(record, "ebitda_budget", dataset)),
      evMultiple: num(record, "ev_multiple", dataset),
      moic: num(record, "moic", dataset),
      irr: num(record, "irr", dataset),
    });
  }
  const funds: BrainFund[] = fundOrder.map((name) => {
    const companies = byFund.get(name)!;
    return {
      name,
      revenue: companies.reduce((sum, company) => sum + company.revenue, 0),
      ebitda: companies.reduce((sum, company) => sum + company.ebitda, 0),
      companies,
    };
  });
  const allCompanies = funds.flatMap((fund) => fund.companies);
  const totalRevenue = allCompanies.reduce((sum, company) => sum + company.revenue, 0);
  const totalEbitda = allCompanies.reduce((sum, company) => sum + company.ebitda, 0);
  const topMoic = allCompanies.reduce((best, company) => Math.max(best, company.moic), 0);
  const stats: BrainStat[] = [
    { label: "Positions", value: String(allCompanies.length) },
    { label: "LTM revenue", value: money0(totalRevenue) },
    { label: "LTM EBITDA", value: money0(totalEbitda) },
    { label: "Top MOIC", value: `${topMoic.toFixed(1)}x` },
  ];
  return { stats, funds };
}

/* ----------------------------------------------------------------- deals */
const DEAL_COLUMNS = [
  "deal",
  "sector",
  "ev",
  "entry_multiple",
  "equity_cheque",
  "stage",
  "status",
] as const;

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

export function computeDeals(text: string): BrainDeals {
  const dataset = BRAIN_DATASETS.deals;
  const table = parseCsv(text);
  if (table.rows.length === 0) throw new Error(`${dataset} has no data rows.`);
  requireColumns(table, DEAL_COLUMNS, dataset);

  const deals: BrainDeal[] = table.rows.map((record) => ({
    tag: initials(record.deal ?? ""),
    name: record.deal ?? "",
    sector: record.sector ?? "",
    ev: num(record, "ev", dataset),
    entryMultiple: num(record, "entry_multiple", dataset),
    equityCheque: num(record, "equity_cheque", dataset),
    stageIndex: stageIndexOf(record.stage ?? ""),
    status: record.status ?? "",
    statusTone: dealTone(record.status ?? ""),
  }));
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

export { money, money0 };
