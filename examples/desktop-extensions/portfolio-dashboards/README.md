# Portfolio Dashboards

A Pi extension with a desktop view that **computes** dashboards from data files
in a working folder and renders them in the True Wind visual format: stat tiles
with budget deltas, actual-vs-plan charts, ranked horizontal bars, and status
tables.

## How a workflow works

A workflow is one JSON file that names a **data file** and declares how to
**compute** a dashboard from that data's columns — nothing is pre-computed:

```json
{
  "id": "revenue",
  "label": "Revenue vs budget",
  "description": "Compute monthly revenue against budget from revenue.csv.",
  "dataset": "revenue.csv",
  "report": {
    "title": "Revenue vs budget",
    "stats": [
      {
        "label": "Revenue to date",
        "agg": "sum",
        "column": "actual",
        "format": "money",
        "delta": { "againstColumn": "budget", "unit": "% vs budget" }
      }
    ],
    "charts": [
      {
        "kind": "cartesian",
        "title": "Monthly revenue against budget, $M",
        "categoryColumn": "month",
        "series": [
          { "name": "Actual", "kind": "bar", "column": "actual" },
          { "name": "Budget", "kind": "line", "column": "budget", "dashed": true }
        ],
        "format": "money"
      }
    ],
    "tables": [
      {
        "title": "By month",
        "columns": [
          { "label": "Month", "column": "month", "align": "left" },
          { "label": "vs budget", "deltaColumns": ["actual", "budget"] }
        ]
      }
    ]
  }
}
```

When the workflow runs, the backend reads `<working folder>/<dataset>`, parses
the CSV, and computes the report:

- **Aggregations** for stats: `sum`, `avg`, `last`, `first`, `max`, `min`, `count`.
- **Deltas**: a stat's `delta.againstColumn` (or a table's `deltaColumns`) is
  rendered as a signed percentage variance, coloured up/down (set `invert: true`
  where lower is better).
- **Charts**: cartesian series read a numeric column across rows against a
  `categoryColumn`; `hbars` rank rows by `valueColumn` (`emphasizeMax` highlights
  the largest).
- **Tables**: cells read a `column` (optionally `format`ted), a `deltaColumns`
  variance, or a `pillMap` that turns a status column into coloured pills.

Change the data file and re-run — the numbers change.

## Working folder

Workflows read from a working folder you choose in the Dashboards tab. It
defaults to the extension's bundled [`sample-data/`](./sample-data), so the
three workflows compute out of the box. Paste an absolute path and press **Set**
to point at your own data, or click **Use workspace folder** to use the project
open in this session. The choice is remembered across restarts.

## Workflows are config files, not code

Configs are rescanned on demand from three places; a later file with the same
`id` overrides an earlier one, so files copy cleanly between machines and
workspaces:

1. the bundled [`workflows/`](./workflows) directory — ships `portfolio`,
   `revenue` and `pipeline`;
2. `~/.pi/agent/dashboards/*.json` — user-wide;
3. `<workspace>/.pi/dashboards/*.json` — per project.

## Run on demand, results cached

A workflow runs only when asked: click its chip in the Dashboards tab, or use
`/dashboard portfolio|revenue|pipeline` in the composer (`/dashboard list`
prints the catalogue). The agent can also publish a ready-made spec through the
`emit_dashboard` tool. Computed dashboards (the last 20) are cached in
`~/.pi/agent/dashboards-cache.json` and restored on the next launch.

Every config, computed result, and tool payload is validated field by field
before it reaches the view; malformed files are reported by path without
breaking the other workflows.

## Build and configure

From the pi-gui repository root, after the normal dependency setup:

```sh
pnpm --filter @pi-gui/extension-ui build
node examples/desktop-extensions/portfolio-dashboards/build.mjs
```

Then add the absolute path to the `extensions` array in the target project's
`.pi/settings.json`, or `~/.pi/agent/settings.json` for user-wide availability,
as described in [the examples README](../README.md).
