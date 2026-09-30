import { defineFacet } from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDesktopView } from "@pi-gui/extension-ui";
import { Dashboards, type DashboardSpec } from "./contract.ts";
import { presetInfos } from "./presets.ts";
import { DashboardStore } from "./store.ts";

/*
 * Portfolio Dashboards example extension.
 *
 * Three pre-configured workflows (/dashboard portfolio|revenue|pipeline) emit
 * fictional demo data, and the emit_dashboard tool lets the agent publish its
 * own data. The desktop view renders every emitted dashboard in the True Wind
 * visual format: stat tiles, budget-vs-actual charts, and status tables.
 */

function summarize(spec: DashboardSpec): string {
  const lines = [
    `${spec.title}${spec.asOf ? ` · ${spec.asOf}` : ""}`,
    ...spec.stats.map(
      (stat) => `  ${stat.label}: ${stat.value}${stat.delta ? ` (${stat.delta.text})` : ""}`,
    ),
    ...spec.charts.map((chart) => `  chart: ${chart.title}`),
    ...spec.tables.map((table) => `  table: ${table.title} · ${table.rows.length} rows`),
  ];
  return lines.join("\n");
}

export default function portfolioDashboardsExtension(pi: ExtensionAPI): void {
  const store = new DashboardStore();

  pi.registerCommand("dashboard", {
    description:
      "Emit a pre-configured dashboard into the Dashboards tab: /dashboard portfolio|revenue|pipeline|list",
    handler(args, ctx) {
      const presetId = args.trim() || "list";
      if (presetId === "list") {
        const listing = presetInfos
          .map((preset) => `  /dashboard ${preset.id} — ${preset.description}`)
          .join("\n");
        ctx.ui.notify(`Pre-configured dashboards:\n${listing}`, "info");
        return Promise.resolve();
      }
      try {
        const record = store.emitPreset(presetId);
        ctx.ui.notify(
          `Dashboard emitted. Open the Dashboards tab to view it.\n${summarize(record.spec)}`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
      return Promise.resolve();
    },
  });

  pi.registerTool({
    name: "emit_dashboard",
    label: "Dashboards",
    description:
      "Publish a dashboard to the desktop Dashboards tab. Pass a spec object with " +
      "title, optional subtitle/asOf/source, stats (label, value, optional delta " +
      "{text, tone: up|down|flat}), charts (kind cartesian {cats, series " +
      "[{name, kind: bar|line, values, slot?, dashed?, dashFrom?}], format?} or " +
      "kind hbars {rows [{label, value, emphasis?}], format?}), and tables " +
      "(title, columns [{label, align?}], rows of cells {text, tone?: pos|neg|muted|strong, " +
      "pill?: good|warning|serious|critical|neutral}). Formats: money, money0, int, pct0, pct1, mult, plain.",
    parameters: Type.Object({ spec: Type.Any() }),
    execute(_toolCallId, params) {
      const record = store.emitSpec(params.spec);
      return Promise.resolve({
        content: [
          {
            type: "text" as const,
            text: `Dashboard "${record.spec.title}" published to the Dashboards tab.\n${summarize(record.spec)}`,
          },
        ],
        details: { dashboardId: record.id },
      });
    },
  });

  registerDesktopView(pi, {
    id: "portfolio-dashboards",
    title: "Dashboards",
    source: import.meta.url,
    frontend: new URL("./dist/desktop.js", import.meta.url),
    backend: () =>
      defineFacet({
        id: "pi-gui.example.portfolio-dashboards.backend",
        setup(env) {
          const state = env.replicatedState(store.snapshot());
          env.own(store.subscribe((next) => state.replace(BACKGROUND_CONTEXT, next)));
          env.provide(Dashboards, {
            state,
            async emitPreset(request, context) {
              context.abortSignal?.throwIfAborted();
              const record = store.emitPreset(request.presetId);
              return { dashboardId: record.id };
            },
          });
        },
      }),
  });
}
