import type {
  CartesianSeries,
  ChartSpec,
  DashboardSpec,
  DeltaTone,
  NumberFormat,
  PillTone,
  StatTile,
  TableCell,
  TableColumn,
  TableSpec,
} from "./contract.ts";
import { isRecord } from "./spec.ts";

/*
 * The compute layer. A workflow config declares a "report": a dataset plus
 * declarative stat/chart/table definitions that reference data columns and
 * aggregations. Given the rows read from the working folder, computeDashboard
 * turns that into a rendered DashboardSpec. This is what makes a dashboard
 * dynamic — change the data file, re-run, and the numbers change.
 */

const AGGREGATIONS = ["sum", "avg", "last", "first", "max", "min", "count"] as const;
type Aggregation = (typeof AGGREGATIONS)[number];
const FORMATS = ["money", "money0", "int", "pct0", "pct1", "mult", "plain"] as const;

export interface DataTable {
  columns: string[];
  rows: Record<string, string>[];
}

export interface ReportSpec {
  title: string;
  subtitle?: string;
  asOf?: string;
  stats: StatDef[];
  charts: ChartDef[];
  tables: TableDef[];
}

interface DeltaDef {
  againstColumn: string;
  againstAgg?: Aggregation;
  unit?: string;
  /** When true, a negative variance is the good outcome (e.g. costs). */
  invert?: boolean;
}

interface StatDef {
  label: string;
  agg: Aggregation;
  column?: string;
  format?: NumberFormat;
  delta?: DeltaDef;
}

interface SeriesDef {
  name: string;
  kind: "bar" | "line";
  column: string;
  slot?: number;
  dashed?: boolean;
}

interface ChartDef {
  kind: "cartesian" | "hbars";
  title: string;
  subtitle?: string;
  format?: NumberFormat;
  yZero?: boolean;
  // cartesian
  categoryColumn?: string;
  series?: SeriesDef[];
  // hbars
  labelColumn?: string;
  valueColumn?: string;
  emphasizeMax?: boolean;
  seriesName?: string;
}

interface TableCellDef {
  label: string;
  align?: "left" | "right";
  column?: string;
  format?: NumberFormat;
  /** [actualColumn, referenceColumn] rendered as a signed percent variance. */
  deltaColumns?: [string, string];
  invert?: boolean;
  /** Maps a column's cell text to a status pill tone. */
  pillMap?: Record<string, PillTone>;
  strong?: boolean;
}

interface TableDef {
  title: string;
  subtitle?: string;
  columns: TableCellDef[];
}

/* ------------------------------------------------------------- validation */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

function str(value: unknown, field: string, limit = 200): string {
  if (!isNonEmptyString(value)) throw new Error(`Report "${field}" must be a non-empty string.`);
  return value.slice(0, limit);
}

function optStr(value: unknown, field: string, limit = 200): string | undefined {
  return value === undefined ? undefined : str(value, field, limit);
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Report "${field}" must be one of ${allowed.join(", ")}.`);
  }
  return value as T;
}

function arr(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Report "${field}" must be an array.`);
  if (value.length > max) throw new Error(`Report "${field}" allows at most ${max} items.`);
  return value;
}

function parseDelta(value: unknown, field: string): DeltaDef | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`Report "${field}" must be an object.`);
  return {
    againstColumn: str(value.againstColumn, `${field}.againstColumn`, 80),
    againstAgg:
      value.againstAgg === undefined
        ? undefined
        : oneOf(value.againstAgg, `${field}.againstAgg`, AGGREGATIONS),
    unit: optStr(value.unit, `${field}.unit`, 40),
    invert: value.invert === true,
  };
}

export function parseReport(value: unknown): ReportSpec {
  if (!isRecord(value)) throw new Error('A workflow "report" must be an object.');
  return {
    title: str(value.title, "report.title", 120),
    subtitle: optStr(value.subtitle, "report.subtitle"),
    asOf: optStr(value.asOf, "report.asOf", 80),
    stats: arr(value.stats ?? [], "report.stats", 6).map((entry, i): StatDef => {
      if (!isRecord(entry)) throw new Error(`Report "stats[${i}]" must be an object.`);
      return {
        label: str(entry.label, `stats[${i}].label`, 60),
        agg: oneOf(entry.agg, `stats[${i}].agg`, AGGREGATIONS),
        column: optStr(entry.column, `stats[${i}].column`, 80),
        format:
          entry.format === undefined
            ? undefined
            : oneOf(entry.format, `stats[${i}].format`, FORMATS),
        delta: parseDelta(entry.delta, `stats[${i}].delta`),
      };
    }),
    charts: arr(value.charts ?? [], "report.charts", 4).map((entry, i): ChartDef => {
      if (!isRecord(entry)) throw new Error(`Report "charts[${i}]" must be an object.`);
      const kind = oneOf(entry.kind, `charts[${i}].kind`, ["cartesian", "hbars"] as const);
      const base = {
        kind,
        title: str(entry.title, `charts[${i}].title`, 120),
        subtitle: optStr(entry.subtitle, `charts[${i}].subtitle`),
        format:
          entry.format === undefined
            ? undefined
            : oneOf(entry.format, `charts[${i}].format`, FORMATS),
        yZero: entry.yZero === undefined ? undefined : entry.yZero === true,
      };
      if (kind === "hbars") {
        return {
          ...base,
          labelColumn: str(entry.labelColumn, `charts[${i}].labelColumn`, 80),
          valueColumn: str(entry.valueColumn, `charts[${i}].valueColumn`, 80),
          emphasizeMax: entry.emphasizeMax === true,
          seriesName: optStr(entry.seriesName, `charts[${i}].seriesName`, 60),
        };
      }
      return {
        ...base,
        categoryColumn: str(entry.categoryColumn, `charts[${i}].categoryColumn`, 80),
        series: arr(entry.series, `charts[${i}].series`, 6).map((s, j): SeriesDef => {
          if (!isRecord(s))
            throw new Error(`Report "charts[${i}].series[${j}]" must be an object.`);
          return {
            name: str(s.name, `charts[${i}].series[${j}].name`, 60),
            kind: oneOf(s.kind, `charts[${i}].series[${j}].kind`, ["bar", "line"] as const),
            column: str(s.column, `charts[${i}].series[${j}].column`, 80),
            slot: s.slot === undefined ? undefined : Number(s.slot),
            dashed: s.dashed === true,
          };
        }),
      };
    }),
    tables: arr(value.tables ?? [], "report.tables", 3).map((entry, i): TableDef => {
      if (!isRecord(entry)) throw new Error(`Report "tables[${i}]" must be an object.`);
      return {
        title: str(entry.title, `tables[${i}].title`, 120),
        subtitle: optStr(entry.subtitle, `tables[${i}].subtitle`),
        columns: arr(entry.columns, `tables[${i}].columns`, 8).map((c, j): TableCellDef => {
          if (!isRecord(c))
            throw new Error(`Report "tables[${i}].columns[${j}]" must be an object.`);
          const deltaColumns = c.deltaColumns;
          let parsedDelta: [string, string] | undefined;
          if (deltaColumns !== undefined) {
            const pair = arr(deltaColumns, `tables[${i}].columns[${j}].deltaColumns`, 2);
            if (pair.length !== 2)
              throw new Error(
                `Report "tables[${i}].columns[${j}].deltaColumns" needs two columns.`,
              );
            parsedDelta = [
              str(pair[0], "deltaColumns[0]", 80),
              str(pair[1], "deltaColumns[1]", 80),
            ];
          }
          let pillMap: Record<string, PillTone> | undefined;
          if (c.pillMap !== undefined) {
            if (!isRecord(c.pillMap))
              throw new Error(`Report "tables[${i}].columns[${j}].pillMap" must be an object.`);
            pillMap = {};
            for (const key of Object.keys(c.pillMap)) {
              pillMap[key] = oneOf(c.pillMap[key], `pillMap.${key}`, [
                "good",
                "warning",
                "serious",
                "critical",
                "neutral",
              ] as const);
            }
          }
          return {
            label: str(c.label, `tables[${i}].columns[${j}].label`, 60),
            align:
              c.align === undefined
                ? undefined
                : oneOf(c.align, `tables[${i}].columns[${j}].align`, ["left", "right"] as const),
            column: optStr(c.column, `tables[${i}].columns[${j}].column`, 80),
            format:
              c.format === undefined
                ? undefined
                : oneOf(c.format, `tables[${i}].columns[${j}].format`, FORMATS),
            deltaColumns: parsedDelta,
            invert: c.invert === true,
            pillMap,
            strong: c.strong === true,
          };
        }),
      };
    }),
  };
}

/* ------------------------------------------------------------- CSV parsing */
/** A small RFC-4180-ish CSV parser: handles quoted fields, commas and newlines. */
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

/* ------------------------------------------------------------- aggregation */
function numeric(record: Record<string, string>, column: string, context: string): number {
  const raw = record[column];
  if (raw === undefined) throw new Error(`Data has no column "${column}" (needed for ${context}).`);
  // Tolerate $, %, commas and en-dash minus signs in source data.
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/[−–]/g, "-");
  const value = Number(cleaned);
  if (cleaned !== "" && !Number.isFinite(value)) {
    throw new Error(
      `Value "${raw}" in column "${column}" is not a number (needed for ${context}).`,
    );
  }
  return cleaned === "" ? Number.NaN : value;
}

function aggregate(
  table: DataTable,
  agg: Aggregation,
  column: string | undefined,
  context: string,
): number {
  if (agg === "count") return table.rows.length;
  if (!column) throw new Error(`Aggregation "${agg}" for ${context} needs a column.`);
  const values = table.rows
    .map((r) => numeric(r, column, context))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "last":
      return values[values.length - 1]!;
    case "first":
      return values[0]!;
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
  }
}

/* ------------------------------------------------------------- formatting */
const FORMATTERS: Record<NumberFormat, (v: number) => string> = {
  money: (v) => `$${v.toFixed(1)}M`,
  money0: (v) => `$${Math.round(v)}M`,
  int: (v) => Math.round(v).toLocaleString(),
  pct0: (v) => `${v.toFixed(0)}%`,
  pct1: (v) => `${v.toFixed(1)}%`,
  mult: (v) => `${v.toFixed(1)}x`,
  plain: (v) => String(v),
};
const fmt = (format: NumberFormat | undefined, v: number): string =>
  FORMATTERS[format ?? "money"](v);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;

function variance(actual: number, reference: number): number | null {
  return reference === 0 ? null : ((actual - reference) / Math.abs(reference)) * 100;
}

function toneFor(value: number | null, invert: boolean): DeltaTone {
  if (value === null || Math.abs(value) < 0.5) return "flat";
  const good = invert ? value < 0 : value > 0;
  return good ? "up" : "down";
}

/* ------------------------------------------------------------- compute */
export function computeDashboard(
  report: ReportSpec,
  table: DataTable,
  source: string,
): DashboardSpec {
  const stats: StatTile[] = report.stats.map((def) => {
    const value = aggregate(table, def.agg, def.column, `stat "${def.label}"`);
    const tile: StatTile = { label: def.label, value: fmt(def.format, value) };
    if (def.delta) {
      const reference = aggregate(
        table,
        def.delta.againstAgg ?? def.agg,
        def.delta.againstColumn,
        `stat "${def.label}" delta`,
      );
      const pct = variance(value, reference);
      tile.delta = {
        text: pct === null ? "—" : `${signed(pct)}${def.delta.unit ?? "%"}`,
        tone: toneFor(pct, def.delta.invert === true),
      };
    }
    return tile;
  });

  const charts: ChartSpec[] = report.charts.map((def) => {
    if (def.kind === "hbars") {
      return {
        kind: "hbars",
        title: def.title,
        subtitle: def.subtitle,
        format: def.format,
        seriesName: def.seriesName,
        rows: (() => {
          const values = table.rows.map((r) =>
            numeric(r, def.valueColumn!, `chart "${def.title}"`),
          );
          const max = Math.max(...values.filter((v) => Number.isFinite(v)), 0);
          return table.rows.map((r, index) => ({
            label: r[def.labelColumn!] ?? "",
            value: Number.isFinite(values[index]!) ? values[index]! : 0,
            emphasis: def.emphasizeMax === true && values[index] === max,
            slot: def.emphasizeMax === true && values[index] === max ? 3 : 1,
          }));
        })(),
      };
    }
    const cats = table.rows.map((r) => r[def.categoryColumn!] ?? "");
    const series: CartesianSeries[] = (def.series ?? []).map((s) => ({
      name: s.name,
      kind: s.kind,
      slot: s.slot,
      dashed: s.dashed,
      values: table.rows.map((r) => {
        const value = numeric(r, s.column, `chart "${def.title}" series "${s.name}"`);
        return Number.isFinite(value) ? value : null;
      }),
    }));
    return {
      kind: "cartesian",
      title: def.title,
      subtitle: def.subtitle,
      format: def.format,
      yZero: def.yZero,
      cats,
      series,
    };
  });

  const tables: TableSpec[] = report.tables.map((def) => {
    const columns: TableColumn[] = def.columns.map((c) => ({ label: c.label, align: c.align }));
    const rows: TableCell[][] = table.rows.map((record) =>
      def.columns.map((c): TableCell => {
        if (c.deltaColumns) {
          const [actualCol, referenceCol] = c.deltaColumns;
          const pct = variance(
            numeric(record, actualCol, `table "${def.title}"`),
            numeric(record, referenceCol, `table "${def.title}"`),
          );
          const tone = toneFor(pct, c.invert === true);
          return {
            text: pct === null ? "—" : `${signed(pct)}%`,
            tone: tone === "up" ? "pos" : tone === "down" ? "neg" : "muted",
          };
        }
        const raw = record[c.column ?? ""] ?? "";
        if (c.pillMap) {
          const pill = c.pillMap[raw] ?? "neutral";
          return { text: raw, pill };
        }
        if (c.format) {
          return {
            text: fmt(c.format, numeric(record, c.column!, `table "${def.title}"`)),
            tone: "strong",
          };
        }
        return c.strong ? { text: raw, tone: "strong" } : { text: raw };
      }),
    );
    return { title: def.title, subtitle: def.subtitle, columns, rows };
  });

  const asOf = (report.asOf ?? "Computed from {source} · {rows} rows")
    .replace("{source}", source)
    .replace("{rows}", String(table.rows.length));

  return {
    title: report.title,
    subtitle: report.subtitle,
    asOf,
    source: `computed from ${source} · ${table.rows.length} rows`,
    stats,
    charts,
    tables,
  };
}
