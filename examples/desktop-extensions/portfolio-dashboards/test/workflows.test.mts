import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { normalizeSpec } from "../spec.ts";
import { loadWorkflows } from "../workflow-loader.ts";
import { DashboardStore } from "../store.ts";

const bundledDir = fileURLToPath(new URL("../workflows/", import.meta.url));

test("every bundled workflow config is valid and complete", () => {
  const scan = loadWorkflows([bundledDir]);
  assert.deepEqual(scan.errors, []);
  assert.deepEqual(scan.workflows.map((workflow) => workflow.id).sort(), [
    "pipeline",
    "portfolio",
    "revenue",
  ]);
  for (const workflow of scan.workflows) {
    assert.ok(workflow.label.length > 0);
    assert.ok(workflow.description.length > 0);
    assert.ok(workflow.dashboard.stats.length > 0, `${workflow.id} has stat tiles`);
    assert.ok(workflow.dashboard.charts.length > 0, `${workflow.id} has a chart`);
    assert.ok(workflow.dashboard.tables.length > 0, `${workflow.id} has a table`);
  }
});

test("user config directories extend and override bundled workflows", () => {
  const userDir = mkdtempSync(join(tmpdir(), "dash-user-"));
  const custom = JSON.parse(readFileSync(join(bundledDir, "pipeline.json"), "utf8"));
  custom.label = "Overridden pipeline";
  writeFileSync(join(userDir, "pipeline.json"), JSON.stringify(custom));
  writeFileSync(
    join(userDir, "custom.json"),
    JSON.stringify({
      id: "custom",
      label: "Custom",
      description: "A user-supplied workflow.",
      dashboard: { title: "Custom", stats: [], charts: [], tables: [] },
    }),
  );
  writeFileSync(join(userDir, "broken.json"), "{not json");
  const scan = loadWorkflows([bundledDir, userDir]);
  assert.equal(
    scan.workflows.find((workflow) => workflow.id === "pipeline")?.label,
    "Overridden pipeline",
  );
  assert.ok(scan.workflows.some((workflow) => workflow.id === "custom"));
  assert.equal(scan.errors.length, 1, "the broken file is reported, not fatal");
});

test("normalizeSpec rejects malformed payloads", () => {
  assert.throws(() => normalizeSpec(null), /JSON object/);
  assert.throws(() => normalizeSpec({ title: "" }), /title/);
  assert.throws(() => normalizeSpec({ title: "x", stats: [{ label: "a" }] }), /stats\[0]\.value/);
  assert.throws(
    () =>
      normalizeSpec({
        title: "x",
        charts: [
          {
            kind: "cartesian",
            title: "c",
            cats: ["a"],
            series: [{ name: "s", kind: "bar", values: [1, 2] }],
          },
        ],
      }),
    /must match cats length/,
  );
  assert.throws(
    () =>
      normalizeSpec({
        title: "x",
        tables: [
          { title: "t", columns: [{ label: "c" }], rows: [[{ text: "v", pill: "sparkly" }]] },
        ],
      }),
    /pill/,
  );
});

test("emitted dashboards are cached to disk and restored on a fresh store", () => {
  const dir = mkdtempSync(join(tmpdir(), "dash-cache-"));
  const cachePath = join(dir, "cache.json");
  const options = { workflowDirectories: () => [bundledDir], cachePath };
  const store = new DashboardStore(options);
  const record = store.emitWorkflow("portfolio");
  assert.equal(record.origin, "workflow");
  assert.equal(record.workflowId, "portfolio");
  store.emitSpec({ title: "From the agent", stats: [], charts: [], tables: [] });

  const restored = new DashboardStore(options);
  const dashboards = restored.snapshot().dashboards;
  assert.equal(dashboards.length, 2);
  assert.equal(dashboards[0]?.spec.title, "Portfolio overview");
  assert.equal(dashboards[1]?.origin, "tool");

  // A corrupt cache is discarded rather than crashing the extension.
  writeFileSync(cachePath, "{broken");
  const afterCorrupt = new DashboardStore(options);
  assert.equal(afterCorrupt.snapshot().dashboards.length, 0);
});

test("the store keeps history bounded and names unknown workflows", () => {
  const store = new DashboardStore({ workflowDirectories: () => [bundledDir] });
  for (let i = 0; i < 30; i += 1) store.emitWorkflow("pipeline");
  assert.ok(store.snapshot().dashboards.length <= 20);
  assert.throws(() => store.emitWorkflow("unknown"), /Known workflows/);
});
