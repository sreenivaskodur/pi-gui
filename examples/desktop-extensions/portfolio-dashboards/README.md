# Portfolio Dashboards

A Pi extension with a desktop view that renders dashboards in the True Wind
prototype's visual format: stat tiles with budget deltas, actual-vs-plan
charts, ranked horizontal bars, and status tables. All bundled figures are
fictional demo data.

## Workflows are config files, not code

A workflow is one JSON file:

```json
{
  "id": "my-dashboard",
  "label": "My dashboard",
  "description": "What this reports.",
  "dashboard": {
    "title": "…",
    "stats": [{ "label": "…", "value": "…", "delta": { "text": "…", "tone": "up" } }],
    "charts": [{ "kind": "cartesian", "title": "…", "cats": ["…"], "series": [] }],
    "tables": [{ "title": "…", "columns": [{ "label": "…" }], "rows": [] }]
  }
}
```

Configs are rescanned on demand from three places; a later file with the same
`id` overrides an earlier one, so files copy cleanly between machines and
workspaces:

1. the extension's bundled [`workflows/`](./workflows) directory — ships
   `portfolio`, `revenue` and `pipeline`;
2. `~/.pi/agent/dashboards/*.json` — user-wide;
3. `<workspace>/.pi/dashboards/*.json` — per project.

Every config and every tool payload is rebuilt field by field before it
reaches the view; malformed files are reported by path without breaking the
other workflows.

## Run on demand, results cached

A workflow runs only when asked: click its chip in the Dashboards tab, or use
the composer — `/dashboard portfolio|revenue|pipeline` (`/dashboard list`
prints the current catalogue). The agent can publish its own data in the same
format through the `emit_dashboard` tool.

Emitted dashboards (the last 20) are cached in
`~/.pi/agent/dashboards-cache.json` and restored on the next launch, so the
tab reopens on the previous results without re-running anything.

## Build and configure

From the pi-gui repository root, after the normal dependency setup:

```sh
pnpm --filter @pi-gui/extension-ui build
node examples/desktop-extensions/portfolio-dashboards/build.mjs
```

Then add the absolute path to the `extensions` array in the target project's
`.pi/settings.json`, or `~/.pi/agent/settings.json` for user-wide availability,
as described in [the examples README](../README.md).
