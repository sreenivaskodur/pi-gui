import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { computeDashboard, parseCsv, parseReport } from "../compute.ts";
import { normalizeSpec } from "../spec.ts";
import { loadWorkflows } from "../workflow-loader.ts";
import { DashboardStore } from "../store.ts";

const bundledDir = fileURLToPath(new URL("../workflows/", import.meta.url));
const sampleDir = fileURLToPath(new URL("../sample-data/", import.meta.url));

test("every bundled workflow parses and names a dataset", () => {
  const scan = loadWorkflows([bundledDir]);
  assert.deepEqual(scan.errors, []);
  assert.deepEqual(scan.workflows.map((workflow) => workflow.id).sort(), [
    "pipeline",
    "portfolio",
    "revenue",
  ]);
  for (const workflow of scan.workflows) {
    assert.ok(workflow.dataset.endsWith(".csv"), `${workflow.id} reads a csv`);
    assert.ok(workflow.report.stats.length > 0);
  }
});

test("parseCsv handles quoted fields, commas and blank lines", () => {
  const table = parseCsv('a,b\n1,"x,y"\n2,"say ""hi"""\n\n');
  assert.deepEqual(table.columns, ["a", "b"]);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0]!.b, "x,y");
  assert.equal(table.rows[1]!.b, 'say "hi"');
});

test("computeDashboard aggregates columns and computes deltas from data", () => {
  const report = parseReport({
    title: "Revenue",
    stats: [
      {
        label: "Total",
        agg: "sum",
        column: "actual",
        format: "money",
        delta: { againstColumn: "budget", unit: "% vs budget" },
      },
      { label: "Months", agg: "count", format: "int" },
    ],
    charts: [
      {
        kind: "cartesian",
        title: "Monthly",
        categoryColumn: "month",
        series: [{ name: "Actual", kind: "bar", column: "actual" }],
      },
    ],
    tables: [
      {
        title: "Rows",
        columns: [
          { label: "Month", column: "month", align: "left" },
          { label: "vs budget", deltaColumns: ["actual", "budget"] },
        ],
      },
    ],
  });
  const table = parseCsv("month,actual,budget\nJan,10,8\nFeb,12,12\n");
  const spec = normalizeSpec(computeDashboard(report, table, "revenue.csv"));
  assert.equal(spec.stats[0]!.value, "$22.0M"); // 10 + 12
  assert.equal(spec.stats[0]!.delta!.tone, "up"); // 22 vs 20 budget
  assert.equal(spec.stats[1]!.value, "2");
  assert.equal(spec.charts[0]!.kind, "cartesian");
  assert.deepEqual(
    spec.charts[0]!.kind === "cartesian" ? spec.charts[0]!.series[0]!.values : [],
    [10, 12],
  );
  assert.equal(spec.tables[0]!.rows[0]![1]!.text, "+25.0%"); // (10-8)/8
  assert.equal(spec.tables[0]!.rows[0]![1]!.tone, "pos");
  assert.equal(spec.tables[0]!.rows[1]![1]!.text, "+0.0%"); // flat
});

test("computing the bundled portfolio workflow against sample data yields real totals", () => {
  const store = new DashboardStore({
    workflowDirectories: () => [bundledDir],
    sampleDataFolder: sampleDir,
  });
  const record = store.emitWorkflow("portfolio");
  assert.equal(record.origin, "workflow");
  assert.equal(record.rows, 5);
  // Sum of ltm_revenue in companies.csv: 148.2+96.7+84.3+71.5+55.0 = 455.7 → $456M.
  assert.equal(record.spec.stats[0]!.value, "$456M");
  assert.ok(record.computedFrom?.endsWith("companies.csv"));
});

test("a workflow errors clearly when the data file is missing", () => {
  const emptyDir = mkdtempSync(join(tmpdir(), "dash-empty-"));
  const store = new DashboardStore({
    workflowDirectories: () => [bundledDir],
    sampleDataFolder: sampleDir,
  });
  store.setWorkingFolder(emptyDir);
  assert.throws(() => store.emitWorkflow("revenue"), /not found in the working folder/);
});

test("user config directories extend and override bundled workflows", () => {
  const userDir = mkdtempSync(join(tmpdir(), "dash-user-"));
  const custom = JSON.parse(readFileSync(join(bundledDir, "pipeline.json"), "utf8"));
  custom.label = "Overridden pipeline";
  writeFileSync(join(userDir, "pipeline.json"), JSON.stringify(custom));
  writeFileSync(join(userDir, "broken.json"), "{not json");
  const scan = loadWorkflows([bundledDir, userDir]);
  assert.equal(scan.workflows.find((w) => w.id === "pipeline")?.label, "Overridden pipeline");
  assert.equal(scan.errors.length, 1);
});

test("emitted dashboards and the working folder are cached and restored", () => {
  const dir = mkdtempSync(join(tmpdir(), "dash-cache-"));
  const cachePath = join(dir, "cache.json");
  const options = {
    workflowDirectories: () => [bundledDir],
    sampleDataFolder: sampleDir,
    cachePath,
  };
  const store = new DashboardStore(options);
  store.emitWorkflow("revenue");
  const restored = new DashboardStore(options);
  assert.equal(restored.snapshot().dashboards.length, 1);
  assert.equal(restored.snapshot().dashboards[0]!.spec.title, "Revenue vs budget");

  writeFileSync(cachePath, "{broken");
  const afterCorrupt = new DashboardStore(options);
  assert.equal(afterCorrupt.snapshot().dashboards.length, 0);
});

test("normalizeSpec still rejects malformed tool payloads", () => {
  assert.throws(() => normalizeSpec(null), /JSON object/);
  assert.throws(() => normalizeSpec({ title: "x", stats: [{ label: "a" }] }), /stats\[0]\.value/);
});
