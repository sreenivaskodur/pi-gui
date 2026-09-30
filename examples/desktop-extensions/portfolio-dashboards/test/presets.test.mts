import assert from "node:assert/strict";
import { test } from "node:test";
import { presetBuilders, presetInfos } from "../presets.ts";
import { DashboardStore, normalizeSpec } from "../store.ts";

test("every advertised preset builds a spec that passes normalization", () => {
  for (const info of presetInfos) {
    const build = presetBuilders[info.id];
    assert.ok(build, `preset "${info.id}" has a builder`);
    const spec = normalizeSpec(build());
    assert.ok(spec.title.length > 0);
    assert.ok(spec.stats.length > 0, `preset "${info.id}" has stat tiles`);
    assert.ok(spec.charts.length > 0, `preset "${info.id}" has a chart`);
    assert.ok(spec.tables.length > 0, `preset "${info.id}" has a table`);
    for (const chart of spec.charts) {
      if (chart.kind === "cartesian") {
        for (const series of chart.series) {
          assert.equal(series.values.length, chart.cats.length);
        }
      }
    }
  }
});

test("normalizeSpec rejects malformed tool payloads", () => {
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

test("the store keeps history bounded and tags origins", () => {
  const store = new DashboardStore();
  const record = store.emitPreset("portfolio");
  assert.equal(record.origin, "preset");
  const toolRecord = store.emitSpec({ title: "From the agent", stats: [], charts: [], tables: [] });
  assert.equal(toolRecord.origin, "tool");
  for (let i = 0; i < 30; i += 1) store.emitPreset("pipeline");
  assert.ok(store.snapshot().dashboards.length <= 20);
  assert.throws(() => store.emitPreset("unknown"), /Known presets/);
});
