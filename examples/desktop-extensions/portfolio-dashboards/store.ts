import {
  DASHBOARD_HISTORY_LIMIT,
  type ChartSpec,
  type DashboardRecord,
  type DashboardSpec,
  type DashboardsState,
  type StatTile,
  type TableCell,
  type TableSpec,
} from "./contract.ts";
import { presetBuilders, presetInfos } from "./presets.ts";

/*
 * In-memory dashboard store. The tool path receives untrusted JSON from the
 * model, so every spec is rebuilt field by field here; nothing is passed
 * through to the view unchecked. History is per app run, not persisted.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function asString(value: unknown, field: string, limit = 300): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Dashboard spec: "${field}" must be a non-empty string.`);
  }
  return value.slice(0, limit);
}

function asOptionalString(value: unknown, field: string, limit = 300): string | undefined {
  return value === undefined ? undefined : asString(value, field, limit);
}

function asFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Dashboard spec: "${field}" must be a finite number.`);
  }
  return value;
}

function asArray(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Dashboard spec: "${field}" must be an array.`);
  if (value.length > max)
    throw new Error(`Dashboard spec: "${field}" allows at most ${max} items.`);
  return value;
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Dashboard spec: "${field}" must be one of ${allowed.join(", ")}.`);
  }
  return value as T;
}

const FORMATS = ["money", "money0", "int", "pct0", "pct1", "mult", "plain"] as const;

function normalizeStat(value: unknown, field: string): StatTile {
  if (!isRecord(value)) throw new Error(`Dashboard spec: "${field}" must be an object.`);
  const stat: StatTile = {
    label: asString(value.label, `${field}.label`, 60),
    value: asString(value.value, `${field}.value`, 40),
  };
  if (value.delta !== undefined) {
    if (!isRecord(value.delta))
      throw new Error(`Dashboard spec: "${field}.delta" must be an object.`);
    stat.delta = {
      text: asString(value.delta.text, `${field}.delta.text`, 60),
      tone: oneOf(value.delta.tone, `${field}.delta.tone`, ["up", "down", "flat"]),
    };
  }
  return stat;
}

function normalizeChart(value: unknown, field: string): ChartSpec {
  if (!isRecord(value)) throw new Error(`Dashboard spec: "${field}" must be an object.`);
  const kind = oneOf(value.kind, `${field}.kind`, ["cartesian", "hbars"]);
  const title = asString(value.title, `${field}.title`, 120);
  const subtitle = asOptionalString(value.subtitle, `${field}.subtitle`);
  const format =
    value.format === undefined ? undefined : oneOf(value.format, `${field}.format`, FORMATS);
  if (kind === "hbars") {
    return {
      kind,
      title,
      subtitle,
      format,
      seriesName: asOptionalString(value.seriesName, `${field}.seriesName`, 60),
      rows: asArray(value.rows, `${field}.rows`, 12).map((row, index) => {
        if (!isRecord(row))
          throw new Error(`Dashboard spec: "${field}.rows[${index}]" must be an object.`);
        return {
          label: asString(row.label, `${field}.rows[${index}].label`, 80),
          value: asFiniteNumber(row.value, `${field}.rows[${index}].value`),
          emphasis: row.emphasis === true,
          slot:
            row.slot === undefined
              ? undefined
              : asFiniteNumber(row.slot, `${field}.rows[${index}].slot`),
        };
      }),
    };
  }
  const cats = asArray(value.cats, `${field}.cats`, 24).map((cat, index) =>
    asString(cat, `${field}.cats[${index}]`, 24),
  );
  return {
    kind,
    title,
    subtitle,
    format,
    yZero: value.yZero === undefined ? undefined : value.yZero === true,
    height:
      value.height === undefined ? undefined : asFiniteNumber(value.height, `${field}.height`),
    cats,
    series: asArray(value.series, `${field}.series`, 6).map((series, index) => {
      if (!isRecord(series))
        throw new Error(`Dashboard spec: "${field}.series[${index}]" must be an object.`);
      const values = asArray(series.values, `${field}.series[${index}].values`, 24).map(
        (entry, valueIndex) =>
          entry === null
            ? null
            : asFiniteNumber(entry, `${field}.series[${index}].values[${valueIndex}]`),
      );
      if (values.length !== cats.length) {
        throw new Error(
          `Dashboard spec: "${field}.series[${index}].values" must match cats length.`,
        );
      }
      return {
        name: asString(series.name, `${field}.series[${index}].name`, 60),
        kind: oneOf(series.kind, `${field}.series[${index}].kind`, ["bar", "line"]),
        values,
        slot:
          series.slot === undefined
            ? undefined
            : asFiniteNumber(series.slot, `${field}.series[${index}].slot`),
        dashed: series.dashed === true,
        dashFrom:
          series.dashFrom === undefined
            ? undefined
            : asFiniteNumber(series.dashFrom, `${field}.series[${index}].dashFrom`),
      };
    }),
  };
}

function normalizeTable(value: unknown, field: string): TableSpec {
  if (!isRecord(value)) throw new Error(`Dashboard spec: "${field}" must be an object.`);
  const columns = asArray(value.columns, `${field}.columns`, 8).map((column, index) => {
    if (!isRecord(column))
      throw new Error(`Dashboard spec: "${field}.columns[${index}]" must be an object.`);
    return {
      label: asString(column.label, `${field}.columns[${index}].label`, 60),
      align:
        column.align === undefined
          ? undefined
          : oneOf(column.align, `${field}.columns[${index}].align`, ["left", "right"]),
    };
  });
  return {
    title: asString(value.title, `${field}.title`, 120),
    subtitle: asOptionalString(value.subtitle, `${field}.subtitle`),
    columns,
    rows: asArray(value.rows, `${field}.rows`, 40).map((row, rowIndex) =>
      asArray(row, `${field}.rows[${rowIndex}]`, columns.length).map(
        (entry, cellIndex): TableCell => {
          const cellField = `${field}.rows[${rowIndex}][${cellIndex}]`;
          if (typeof entry === "string") return { text: entry.slice(0, 160) };
          if (!isRecord(entry))
            throw new Error(`Dashboard spec: "${cellField}" must be a string or object.`);
          return {
            text: asString(entry.text, `${cellField}.text`, 160),
            tone:
              entry.tone === undefined
                ? undefined
                : oneOf(entry.tone, `${cellField}.tone`, [
                    "pos",
                    "neg",
                    "muted",
                    "strong",
                  ] as const),
            pill:
              entry.pill === undefined
                ? undefined
                : oneOf(entry.pill, `${cellField}.pill`, [
                    "good",
                    "warning",
                    "serious",
                    "critical",
                    "neutral",
                  ] as const),
          };
        },
      ),
    ),
  };
}

export function normalizeSpec(value: unknown): DashboardSpec {
  if (!isRecord(value)) throw new Error("Dashboard spec must be a JSON object.");
  return {
    title: asString(value.title, "title", 120),
    subtitle: asOptionalString(value.subtitle, "subtitle"),
    asOf: asOptionalString(value.asOf, "asOf", 80),
    source: asOptionalString(value.source, "source", 160),
    stats: asArray(value.stats ?? [], "stats", 6).map((stat, index) =>
      normalizeStat(stat, `stats[${index}]`),
    ),
    charts: asArray(value.charts ?? [], "charts", 4).map((chart, index) =>
      normalizeChart(chart, `charts[${index}]`),
    ),
    tables: asArray(value.tables ?? [], "tables", 3).map((table, index) =>
      normalizeTable(table, `tables[${index}]`),
    ),
  };
}

export class DashboardStore {
  private state: DashboardsState = {
    ready: true,
    error: null,
    presets: presetInfos,
    dashboards: [],
  };
  private listeners = new Set<(state: DashboardsState) => void>();
  private counter = 0;

  snapshot(): DashboardsState {
    return this.state;
  }

  subscribe(listener: (state: DashboardsState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitPreset(presetId: string): DashboardRecord {
    const build = presetBuilders[presetId];
    if (!build) {
      const known = Object.keys(presetBuilders).join(", ");
      throw new Error(`Unknown dashboard preset "${presetId}". Known presets: ${known}.`);
    }
    return this.push(build(), "preset");
  }

  emitSpec(value: unknown): DashboardRecord {
    return this.push(normalizeSpec(value), "tool");
  }

  private push(spec: DashboardSpec, origin: DashboardRecord["origin"]): DashboardRecord {
    this.counter += 1;
    const record: DashboardRecord = {
      id: `dash_${this.counter}_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      origin,
      spec,
    };
    this.state = {
      ...this.state,
      dashboards: [...this.state.dashboards, record].slice(-DASHBOARD_HISTORY_LIMIT),
    };
    for (const listener of this.listeners) listener(this.state);
    return record;
  }
}
