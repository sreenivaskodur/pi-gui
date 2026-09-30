import { defineService, type Context, type ReplicatedState } from "@earendil-works/chord";

/*
 * Shared contract between the extension backend and its desktop view.
 * A dashboard is a declarative spec; the view renders it in the True Wind
 * visual format (stat tiles, cartesian charts, horizontal bars, tables).
 */

export const DASHBOARD_HISTORY_LIMIT = 20;

export type NumberFormat = "money" | "money0" | "int" | "pct0" | "pct1" | "mult" | "plain";

export type DeltaTone = "up" | "down" | "flat";

export interface StatTile {
  label: string;
  value: string;
  delta?: { text: string; tone: DeltaTone };
}

export interface CartesianSeries {
  name: string;
  kind: "bar" | "line";
  values: (number | null)[];
  /** Palette slot 1-8; 1 is the subject, 2 the reference grey. */
  slot?: number;
  dashed?: boolean;
  /** Index from which the line is drawn dashed (forecast segment). */
  dashFrom?: number;
}

export interface CartesianChart {
  kind: "cartesian";
  title: string;
  subtitle?: string;
  cats: string[];
  series: CartesianSeries[];
  format?: NumberFormat;
  yZero?: boolean;
  height?: number;
}

export interface HBarRow {
  label: string;
  value: number;
  emphasis?: boolean;
  slot?: number;
}

export interface HBarChart {
  kind: "hbars";
  title: string;
  subtitle?: string;
  rows: HBarRow[];
  format?: NumberFormat;
  seriesName?: string;
}

export type ChartSpec = CartesianChart | HBarChart;

export type CellTone = "pos" | "neg" | "muted" | "strong";

export type PillTone = "good" | "warning" | "serious" | "critical" | "neutral";

export interface TableCell {
  text: string;
  tone?: CellTone;
  pill?: PillTone;
}

export interface TableColumn {
  label: string;
  align?: "left" | "right";
}

export interface TableSpec {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: TableCell[][];
}

export interface DashboardSpec {
  title: string;
  subtitle?: string;
  asOf?: string;
  stats: StatTile[];
  charts: ChartSpec[];
  tables: TableSpec[];
  /** Provenance line, e.g. which workflow produced the data. */
  source?: string;
}

export interface WorkflowInfo {
  id: string;
  label: string;
  description: string;
}

export interface DashboardRecord {
  id: string;
  createdAt: string;
  origin: "workflow" | "tool";
  workflowId?: string;
  spec: DashboardSpec;
}

export interface DashboardsState {
  ready: boolean;
  error: string | null;
  workflows: WorkflowInfo[];
  dashboards: DashboardRecord[];
}

export interface EmitWorkflowRequest {
  workflowId: string;
  requestId: string;
}

export interface DashboardsService {
  state: ReplicatedState<DashboardsState>;
  emitWorkflow(request: EmitWorkflowRequest, context: Context): Promise<{ dashboardId: string }>;
}

export const Dashboards = defineService<DashboardsService>(
  "pi-gui.example.portfolio-dashboards.v1",
);
