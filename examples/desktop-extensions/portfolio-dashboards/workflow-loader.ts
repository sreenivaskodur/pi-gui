import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowInfo } from "./contract.ts";
import { parseReport, type ReportSpec } from "./compute.ts";
import { isRecord } from "./spec.ts";

/*
 * Workflow configs are plain JSON files, discovered at runtime, so they are
 * transferable between machines and workspaces without code changes:
 *
 *   {
 *     "id": "...", "label": "...", "description": "...",
 *     "dataset": "revenue.csv",   // file read from the working folder
 *     "report": { ...declarative compute over the data's columns... }
 *   }
 *
 * Directories are scanned in order and a later file with the same id replaces
 * an earlier one, so a user or workspace config overrides a bundled one.
 */

export interface WorkflowConfig extends WorkflowInfo {
  report: ReportSpec;
}

export interface WorkflowScan {
  workflows: WorkflowConfig[];
  errors: string[];
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
// A dataset is a bare filename in the working folder — no path traversal.
const DATASET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

export function parseWorkflowConfig(value: unknown, source: string): WorkflowConfig {
  if (!isRecord(value)) throw new Error(`${source}: a workflow config must be a JSON object.`);
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) {
    throw new Error(`${source}: "id" must be a lowercase slug (letters, digits, dashes).`);
  }
  if (typeof value.label !== "string" || value.label.trim() === "") {
    throw new Error(`${source}: "label" must be a non-empty string.`);
  }
  if (typeof value.description !== "string" || value.description.trim() === "") {
    throw new Error(`${source}: "description" must be a non-empty string.`);
  }
  if (typeof value.dataset !== "string" || !DATASET_PATTERN.test(value.dataset)) {
    throw new Error(`${source}: "dataset" must be a bare data filename (no path segments).`);
  }
  return {
    id: value.id,
    label: value.label.slice(0, 60),
    description: value.description.slice(0, 200),
    dataset: value.dataset,
    report: parseReport(value.report),
  };
}

export function loadWorkflows(directories: readonly string[]): WorkflowScan {
  const byId = new Map<string, WorkflowConfig>();
  const errors: string[] = [];
  for (const directory of directories) {
    let entries: string[];
    try {
      entries = readdirSync(directory).filter((entry) => entry.endsWith(".json"));
    } catch {
      continue; // A missing directory just contributes nothing.
    }
    for (const entry of entries.sort()) {
      const source = join(directory, entry);
      try {
        const parsed: unknown = JSON.parse(readFileSync(source, "utf8"));
        const workflow = parseWorkflowConfig(parsed, source);
        byId.set(workflow.id, workflow);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${source}: ${String(error)}`);
      }
    }
  }
  return { workflows: [...byId.values()], errors };
}
