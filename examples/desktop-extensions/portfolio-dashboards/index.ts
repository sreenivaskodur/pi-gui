import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineFacet } from "@earendil-works/chord";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { registerDesktopView } from "@pi-gui/extension-ui";
import { Dashboards, type DashboardSpec } from "./contract.ts";
import { DashboardStore } from "./store.ts";

/*
 * Portfolio Dashboards example extension.
 *
 * Workflows are JSON config files, independent of this code: the bundled
 * workflows/ directory ships three demos, and users add their own under
 * ~/.pi/agent/dashboards or the workspace's .pi/dashboards. Each runs on
 * demand (/dashboard <id>, a workflow chip, or the emit_dashboard tool) and
 * results are cached to disk so they survive a restart. The desktop view
 * renders every dashboard in the True Wind visual format.
 */

const bundledWorkflowsDir = fileURLToPath(new URL("./workflows/", import.meta.url));

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
  const agentDir = getAgentDir();
  let workspaceDir: string | null = null;
  const store = new DashboardStore({
    // Later directories win, so a workspace config overrides a user-wide one,
    // which overrides a bundled one with the same id.
    workflowDirectories: () => [
      bundledWorkflowsDir,
      join(agentDir, "dashboards"),
      ...(workspaceDir ? [join(workspaceDir, ".pi", "dashboards")] : []),
    ],
    cachePath: join(agentDir, "dashboards-cache.json"),
  });

  const trackWorkspace = (_event: unknown, ctx: ExtensionContext) => {
    workspaceDir = ctx.cwd;
    store.refreshWorkflows();
  };
  pi.on("session_start", trackWorkspace);
  pi.on("session_tree", trackWorkspace);

  pi.registerCommand("dashboard", {
    description:
      "Run a dashboard workflow into the Dashboards tab: /dashboard <id> or /dashboard list",
    handler(args, ctx) {
      const workflowId = args.trim() || "list";
      if (workflowId === "list") {
        store.refreshWorkflows();
        const { workflows, error } = store.snapshot();
        const listing = workflows
          .map((workflow) => `  /dashboard ${workflow.id} — ${workflow.description}`)
          .join("\n");
        ctx.ui.notify(
          `Dashboard workflows:\n${listing || "  (none found)"}${error ? `\n${error}` : ""}`,
          "info",
        );
        return Promise.resolve();
      }
      try {
        const record = store.emitWorkflow(workflowId);
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
            async emitWorkflow(request, context) {
              context.abortSignal?.throwIfAborted();
              const record = store.emitWorkflow(request.workflowId);
              return { dashboardId: record.id };
            },
          });
        },
      }),
  });
}
