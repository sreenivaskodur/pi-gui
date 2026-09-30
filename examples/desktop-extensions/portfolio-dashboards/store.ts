import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import {
  DASHBOARD_HISTORY_LIMIT,
  type DashboardRecord,
  type DashboardSpec,
  type DashboardsState,
} from "./contract.ts";
import { computeDashboard, parseCsv } from "./compute.ts";
import { isRecord, normalizeSpec } from "./spec.ts";
import { loadWorkflows, type WorkflowConfig } from "./workflow-loader.ts";

/*
 * Runtime dashboard store. Workflow definitions come from JSON configs
 * rescanned on demand; each one reads a data file from the user's working
 * folder and computes the dashboard from it. Emitted results are cached to
 * disk so they survive an app restart.
 */

/** Drops undefined-valued keys so the value is strict JSON (chord's requirement). */
function jsonClean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface DashboardStoreOptions {
  /** Directories scanned for workflow configs; later directories win on id. */
  workflowDirectories: () => readonly string[];
  /** The bundled sample-data folder, used until the user points elsewhere. */
  sampleDataFolder: string;
  /** The session's workspace folder, offered as a one-click working folder. */
  workspaceFolder?: () => string | null;
  /** Optional JSON file the emitted dashboards and chosen folder are cached in. */
  cachePath?: string;
}

export class DashboardStore {
  private state: DashboardsState = {
    ready: true,
    error: null,
    workingFolder: "",
    usingSampleData: true,
    workspaceFolder: null,
    workflows: [],
    dashboards: [],
  };
  private workflowsById = new Map<string, WorkflowConfig>();
  private listeners = new Set<(state: DashboardsState) => void>();
  private counter = 0;
  private chosenFolder: string | null = null;
  private readonly options: DashboardStoreOptions;

  constructor(options: DashboardStoreOptions) {
    this.options = options;
    this.state.workingFolder = options.sampleDataFolder;
    this.restoreCache();
    this.refreshWorkflows();
  }

  snapshot(): DashboardsState {
    return this.state;
  }

  subscribe(listener: (state: DashboardsState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Rescan configs and re-derive folder-dependent state. */
  refreshWorkflows(): void {
    const scan = loadWorkflows(this.options.workflowDirectories());
    this.workflowsById = new Map(scan.workflows.map((workflow) => [workflow.id, workflow]));
    const workingFolder = this.chosenFolder ?? this.options.sampleDataFolder;
    this.update({
      workflows: scan.workflows.map(({ id, label, description, dataset }) => ({
        id,
        label,
        description,
        dataset,
      })),
      workingFolder,
      usingSampleData: this.chosenFolder === null,
      workspaceFolder: this.options.workspaceFolder?.() ?? null,
      error: scan.errors.length ? scan.errors.join("\n") : null,
    });
  }

  setWorkingFolder(folder: string | null): void {
    if (folder !== null) {
      if (!isAbsolute(folder)) throw new Error("The working folder must be an absolute path.");
      if (!existsSync(folder) || !statSync(folder).isDirectory()) {
        throw new Error(`Not a folder: ${folder}`);
      }
    }
    this.chosenFolder = folder;
    this.persistCache();
    this.refreshWorkflows();
  }

  emitWorkflow(workflowId: string): DashboardRecord {
    this.refreshWorkflows();
    const workflow = this.workflowsById.get(workflowId);
    if (!workflow) {
      const known = [...this.workflowsById.keys()].join(", ") || "(none found)";
      throw new Error(`Unknown dashboard workflow "${workflowId}". Known workflows: ${known}.`);
    }
    const dataPath = join(this.state.workingFolder, workflow.dataset);
    if (!existsSync(dataPath)) {
      throw new Error(
        `Data file "${workflow.dataset}" not found in the working folder (${this.state.workingFolder}). ` +
          `Point the working folder at one that contains ${workflow.dataset}.`,
      );
    }
    const table = parseCsv(readFileSync(dataPath, "utf8"));
    if (table.rows.length === 0) throw new Error(`"${workflow.dataset}" has no data rows.`);
    const spec = normalizeSpec(computeDashboard(workflow.report, table, workflow.dataset));
    return this.push(spec, "workflow", {
      workflowId: workflow.id,
      computedFrom: dataPath,
      rows: table.rows.length,
    });
  }

  emitSpec(value: unknown): DashboardRecord {
    return this.push(normalizeSpec(value), "tool", {});
  }

  private push(
    spec: DashboardSpec,
    origin: DashboardRecord["origin"],
    extra: { workflowId?: string; computedFrom?: string; rows?: number },
  ): DashboardRecord {
    this.counter += 1;
    // Chord's replicated state requires strict JSON, so drop undefined-valued
    // optional keys (subtitle, asOf, deltas, …) that the validator leaves in.
    const record = jsonClean<DashboardRecord>({
      id: `dash_${this.counter}_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      origin,
      ...extra,
      spec,
    });
    this.update({
      dashboards: [...this.state.dashboards, record].slice(-DASHBOARD_HISTORY_LIMIT),
    });
    this.persistCache();
    return record;
  }

  private update(patch: Partial<DashboardsState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private restoreCache(): void {
    const path = this.options.cachePath;
    if (!path) return;
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      return; // No cache yet.
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return;
      if (typeof parsed.workingFolder === "string" && isAbsolute(parsed.workingFolder)) {
        this.chosenFolder = parsed.workingFolder;
        this.state.workingFolder = parsed.workingFolder;
      }
      if (!Array.isArray(parsed.dashboards)) return;
      const dashboards: DashboardRecord[] = [];
      for (const entry of parsed.dashboards.slice(-DASHBOARD_HISTORY_LIMIT)) {
        if (!isRecord(entry)) continue;
        const origin = entry.origin === "tool" ? "tool" : "workflow";
        if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") continue;
        dashboards.push(
          jsonClean({
            id: entry.id,
            createdAt: entry.createdAt,
            origin,
            workflowId: typeof entry.workflowId === "string" ? entry.workflowId : undefined,
            computedFrom: typeof entry.computedFrom === "string" ? entry.computedFrom : undefined,
            rows: typeof entry.rows === "number" ? entry.rows : undefined,
            spec: normalizeSpec(entry.spec),
          }),
        );
      }
      this.state = { ...this.state, dashboards };
      this.counter = dashboards.length;
    } catch {
      // A corrupt cache is discarded rather than crashing the extension.
    }
  }

  private persistCache(): void {
    const path = this.options.cachePath;
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      const payload = { workingFolder: this.chosenFolder, dashboards: this.state.dashboards };
      writeFileSync(temporary, `${JSON.stringify(payload)}\n`);
      renameSync(temporary, path);
    } catch {
      // Caching is best-effort; emitting still succeeds without it.
    }
  }
}
