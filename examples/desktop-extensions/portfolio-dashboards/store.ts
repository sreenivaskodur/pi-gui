import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  DASHBOARD_HISTORY_LIMIT,
  type DashboardRecord,
  type DashboardSpec,
  type DashboardsState,
} from "./contract.ts";
import { isRecord, normalizeSpec } from "./spec.ts";
import { loadWorkflows, type WorkflowConfig } from "./workflow-loader.ts";

/*
 * Runtime dashboard store. Workflow definitions come from JSON config files
 * rescanned on demand, so they stay independent of the code; emitted results
 * are cached to disk so they survive an app restart. Both the cache and the
 * configs go through the spec validator before reaching the view.
 */

export interface DashboardStoreOptions {
  /** Directories scanned for workflow configs; later directories win on id. */
  workflowDirectories: () => readonly string[];
  /** Optional JSON file the emitted dashboards are cached in. */
  cachePath?: string;
}

export class DashboardStore {
  private state: DashboardsState = { ready: true, error: null, workflows: [], dashboards: [] };
  private workflowsById = new Map<string, WorkflowConfig>();
  private listeners = new Set<(state: DashboardsState) => void>();
  private counter = 0;
  private readonly options: DashboardStoreOptions;

  constructor(options: DashboardStoreOptions) {
    this.options = options;
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

  /** Rescan the workflow config directories. */
  refreshWorkflows(): void {
    const scan = loadWorkflows(this.options.workflowDirectories());
    this.workflowsById = new Map(scan.workflows.map((workflow) => [workflow.id, workflow]));
    this.update({
      workflows: scan.workflows.map(({ id, label, description }) => ({ id, label, description })),
      error: scan.errors.length ? scan.errors.join("\n") : null,
    });
  }

  emitWorkflow(workflowId: string): DashboardRecord {
    this.refreshWorkflows();
    const workflow = this.workflowsById.get(workflowId);
    if (!workflow) {
      const known = [...this.workflowsById.keys()].join(", ") || "(none found)";
      throw new Error(`Unknown dashboard workflow "${workflowId}". Known workflows: ${known}.`);
    }
    return this.push(workflow.dashboard, "workflow", workflow.id);
  }

  emitSpec(value: unknown): DashboardRecord {
    return this.push(normalizeSpec(value), "tool");
  }

  private push(
    spec: DashboardSpec,
    origin: DashboardRecord["origin"],
    workflowId?: string,
  ): DashboardRecord {
    this.counter += 1;
    const record: DashboardRecord = {
      id: `dash_${this.counter}_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      origin,
      workflowId,
      spec,
    };
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
      if (!isRecord(parsed) || !Array.isArray(parsed.dashboards)) return;
      const dashboards: DashboardRecord[] = [];
      for (const entry of parsed.dashboards.slice(-DASHBOARD_HISTORY_LIMIT)) {
        if (!isRecord(entry)) continue;
        const origin = entry.origin === "tool" ? "tool" : "workflow";
        if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") continue;
        dashboards.push({
          id: entry.id,
          createdAt: entry.createdAt,
          origin,
          workflowId: typeof entry.workflowId === "string" ? entry.workflowId : undefined,
          spec: normalizeSpec(entry.spec),
        });
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
      writeFileSync(temporary, `${JSON.stringify({ dashboards: this.state.dashboards })}\n`);
      renameSync(temporary, path);
    } catch {
      // Caching is best-effort; emitting still succeeds without it.
    }
  }
}
