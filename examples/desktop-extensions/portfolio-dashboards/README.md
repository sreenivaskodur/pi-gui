# Portfolio Dashboards

A Pi extension with a desktop view that renders dashboards in the True Wind
prototype's visual format: stat tiles with budget deltas, actual-vs-plan
charts, ranked horizontal bars, and status tables. All preset figures are
fictional demo data.

## Pre-configured workflows

Three workflows each emit one dashboard. Run them from the Dashboards tab's
workflow chips, or from the composer:

- `/dashboard portfolio` — fund NAV against plan plus every company against budget.
- `/dashboard revenue` — one company's monthly revenue, margin and retention against budget.
- `/dashboard pipeline` — active deals ranked by enterprise value with stage and status.
- `/dashboard list` — print the catalogue.

## Agent-emitted data

The `emit_dashboard` tool lets the agent publish its own data in the same
format: a declarative spec with `stats`, `charts` (`cartesian` or `hbars`) and
`tables`. The backend rebuilds every field of the untrusted payload before it
reaches the view; malformed specs are rejected with a field-level error.

Dashboards live in memory for the app run (last 20 kept); they are not
persisted to the session.

## Build and configure

From the pi-gui repository root, after the normal dependency setup:

```sh
pnpm --filter @pi-gui/extension-ui build
node examples/desktop-extensions/portfolio-dashboards/build.mjs
```

Then add the absolute path to the `extensions` array in the target project's
`.pi/settings.json`, or `~/.pi/agent/settings.json` for user-wide availability,
as described in [the examples README](../README.md).
