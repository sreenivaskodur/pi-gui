import { useCallback, useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type {
  BrainComputeResult,
  BrainDeal,
  BrainDetailResult,
  BrainModelSelection,
  BrainReportKind,
  BrainStat,
  BrainTraceStep,
} from "../../../contracts/brain";
import { DEAL_STAGES, money0 } from "../../../contracts/brain";
import type { PiDesktopApi } from "../../../contracts/ipc";
import type { ScheduledTaskRecord, SessionRecord } from "../../../contracts/desktop-state";
import { ModelSelector } from "../conversation/model-selector";
import { AgentsIcon } from "../../ui/icons";
import { BrainChart } from "./brain-chart";

/*
 * The Ask/Portfolio/Deals/Agents section pages. Portfolio and Deals are
 * workflows: a preset prompt runs through the model (brainCompute IPC), which
 * inspects the working folder and returns the report; results are cached and
 * re-run on demand. Agents reflects the session's real scheduled tasks and
 * running threads. No static demo data.
 */

// Fixed navy/slate ramp for the brand chips — dark enough for white text in
// both light and dark themes, and on-palette with the single-blue design.
const LOGO_COLORS = ["#1c5cab", "#2a78d6", "#0d366b", "#334155"];
const logoColor = (index: number) => LOGO_COLORS[index % LOGO_COLORS.length]!;

interface PageProps {
  readonly api: PiDesktopApi;
  readonly workspaceFolder: string | null;
  readonly runtime: RuntimeSnapshot | undefined;
}

function StatRow({ stats }: { readonly stats: readonly BrainStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="brain__stats">
      {stats.map((stat) => (
        <div className="brain__stat" key={stat.label}>
          <div className="k">{stat.label}</div>
          <div className="v">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

function FolderBar({
  folder,
  chosen,
  busy,
  canRun,
  hasResult,
  hasWorkspace,
  onChoose,
  onUseWorkspace,
  onRun,
}: {
  readonly folder: string | null;
  readonly chosen: boolean;
  readonly busy: boolean;
  readonly canRun: boolean;
  readonly hasResult: boolean;
  readonly hasWorkspace: boolean;
  readonly onChoose: () => void;
  readonly onUseWorkspace: () => void;
  readonly onRun: () => void;
}) {
  return (
    <div className="brain__folderbar">
      <span className="brain__folderbar-lab">Working folder</span>
      <code className="brain__folder-path" title={folder ?? undefined}>
        {chosen && folder ? folder : "None selected"}
      </code>
      <button className="brain__link-btn" type="button" disabled={busy} onClick={onChoose}>
        Choose folder…
      </button>
      {hasWorkspace ? (
        <button className="brain__link-btn" type="button" disabled={busy} onClick={onUseWorkspace}>
          Use workspace folder
        </button>
      ) : null}
      <button
        className="brain__run-btn"
        type="button"
        disabled={busy || !canRun}
        onClick={onRun}
        title={canRun ? undefined : "Choose a working folder and a model first"}
      >
        {busy ? "Running…" : hasResult ? "Re-run workflow" : "Run workflow"}
      </button>
    </div>
  );
}

function useBrainReport(
  api: PiDesktopApi,
  kind: BrainReportKind,
  workspaceFolder: string | null,
  model: BrainModelSelection | undefined,
) {
  const [result, setResult] = useState<BrainComputeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    (rerun: boolean) => {
      let cancelled = false;
      setBusy(true);
      api
        .brainCompute(kind, workspaceFolder, rerun, model ?? null)
        .then((next) => {
          if (!cancelled) setResult(next);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setResult({
              kind,
              folder: workspaceFolder,
              chosen: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [api, kind, workspaceFolder, model],
  );
  // On open: fetch the cached result if any. The backend never runs the model
  // here — a run happens only when the user presses Run (rerun) with a folder
  // and model selected.
  useEffect(() => run(false), [run]);
  const afterFolderChange = useCallback(
    (change: Promise<unknown>) => {
      setBusy(true);
      change.then(() => run(false)).catch(() => setBusy(false));
    },
    [run],
  );
  const choose = useCallback(
    () => afterFolderChange(api.brainPickDataFolder()),
    [afterFolderChange, api],
  );
  const useWorkspace = useCallback(
    () =>
      workspaceFolder ? afterFolderChange(api.brainSetDataFolder(workspaceFolder)) : undefined,
    [afterFolderChange, api, workspaceFolder],
  );
  const rerun = useCallback(() => run(true), [run]);
  return { result, busy, choose, useWorkspace, rerun };
}

function SetupState({
  folderReady,
  modelReady,
}: {
  readonly folderReady: boolean;
  readonly modelReady: boolean;
}) {
  const missing = [!folderReady && "a working folder", !modelReady && "a model"]
    .filter(Boolean)
    .join(" and ");
  return (
    <div className="brain__empty">
      <b>Set up this workflow.</b>
      <br />
      {missing
        ? `Choose ${missing} above, then Run workflow — it won't run on its own.`
        : "Press Run workflow to generate this report."}
    </div>
  );
}

function RunningState({ folder }: { readonly folder: string | null }) {
  return (
    <div className="brain__empty">
      <b>Running the workflow…</b>
      <br />
      {folder ? `Asking the model to analyse ${folder}.` : "Asking the model for the report."}
    </div>
  );
}

function EmptyState({ result }: { readonly result: BrainComputeResult }) {
  return (
    <div className="brain__empty">
      <b>No result.</b>
      <br />
      {result.error ?? "Run the workflow to generate this report."}
    </div>
  );
}

function Trace({
  steps,
  model,
}: {
  readonly steps: readonly BrainTraceStep[];
  readonly model?: string;
}) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <div className="brain__trace">
      <button className="brain__trace-head" type="button" onClick={() => setOpen((v) => !v)}>
        <span className="brain__trace-spark">✦</span>
        <span>How this was generated{model ? ` · ${model}` : ""}</span>
        <span className="brain__trace-toggle">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ol className="brain__trace-list">
          {steps.map((step, index) => (
            <li key={index}>
              <span className="brain__trace-step">{step.label}</span>
              {step.detail ? <span className="brain__trace-detail">{step.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function useBrainDetail(
  api: PiDesktopApi,
  kind: BrainReportKind,
  entity: string,
  workspaceFolder: string | null,
  model: BrainModelSelection | undefined,
) {
  const [result, setResult] = useState<BrainDetailResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    (rerun: boolean) => {
      let cancelled = false;
      setBusy(true);
      api
        .brainDetail(kind, entity, workspaceFolder, rerun, model ?? null)
        .then((next) => {
          if (!cancelled) setResult(next);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setResult({
              kind,
              entity,
              folder: workspaceFolder,
              chosen: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [api, kind, entity, workspaceFolder, model],
  );
  useEffect(() => run(false), [run]);
  const rerun = useCallback(() => run(true), [run]);
  return { result, busy, rerun };
}

interface DetailViewProps {
  readonly api: PiDesktopApi;
  readonly kind: BrainReportKind;
  readonly entity: string;
  readonly workspaceFolder: string | null;
  readonly runtime: RuntimeSnapshot | undefined;
  readonly onBack: () => void;
}

export function DetailView({
  api,
  kind,
  entity,
  workspaceFolder,
  runtime,
  onBack,
}: DetailViewProps) {
  const { model, provider, modelId, selected: modelReady, select } = useWorkflowModel();
  const { result, busy, rerun } = useBrainDetail(api, kind, entity, workspaceFolder, model);
  const detail = result?.detail;
  const folderReady = result?.chosen === true;
  const canRun = folderReady && modelReady;
  return (
    <section className="brain" data-testid="brain-detail">
      <div className="brain__pad">
        <button className="brain__back" type="button" onClick={onBack}>
          ← Back to {kind === "portfolio" ? "Portfolio" : "Deals"}
        </button>
        <div className="brain__head">
          <div className="grow">
            <h1>{detail?.title ?? entity}</h1>
            {detail?.subtitle ? <p>{detail.subtitle}</p> : null}
          </div>
          <div className="brain__head-controls">
            <ModelSelector
              runtime={runtime}
              provider={provider}
              modelId={modelId}
              thinkingLevel={undefined}
              dropdownPlacement="below"
              onSetModel={select}
              onSetThinking={() => undefined}
            />
            {detail?.status ? (
              <span className={`brain__pill ${detail.statusTone ?? "warning"}`}>
                <span className="ic">{detail.statusTone === "good" ? "✓" : "!"}</span>
                {detail.status}
              </span>
            ) : null}
            <button
              className="brain__run-btn"
              type="button"
              disabled={busy || !canRun}
              onClick={rerun}
              title={canRun ? undefined : "Choose a model first"}
            >
              {busy ? "Running…" : detail ? "Re-run" : "Run workflow"}
            </button>
          </div>
        </div>
        {result?.trace ? <Trace steps={result.trace} model={result.model} /> : null}
        {!detail ? (
          busy ? (
            <div className="brain__empty">
              <b>Running the detail workflow…</b>
              <br />
              Asking the model to profile {entity}.
            </div>
          ) : result?.needsSetup ? (
            <SetupState folderReady={folderReady} modelReady={modelReady} />
          ) : result ? (
            <div className="brain__empty">
              <b>No detail.</b>
              <br />
              {result.error ?? "Re-run to generate this profile."}
            </div>
          ) : null
        ) : (
          <>
            {detail.stats.length > 0 ? <StatRow stats={detail.stats} /> : null}
            {detail.charts.map((chart, index) => (
              <div className="brain__card" key={index}>
                <div className="brain__card-head">
                  <h3 className="grow">{chart.title}</h3>
                </div>
                <BrainChart chart={chart} />
              </div>
            ))}
            {detail.rows.length > 0 ? (
              <div className="brain__card">
                <div className="brain__card-head">
                  <h3 className="grow">Key facts</h3>
                </div>
                <table className="brain__tbl">
                  <tbody>
                    {detail.rows.map((row, index) => (
                      <tr key={index}>
                        <td className="left cell-muted">{row.label}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {detail.notes.map((note, index) => (
              <div className="brain__card" key={`note-${index}`}>
                <div className="brain__card-head">
                  <h3 className="grow">{note.heading}</h3>
                </div>
                {note.body.map((paragraph, pIndex) => (
                  <p className="brain__note-p" key={pIndex}>
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
            {result?.folder ? (
              <div className="brain__prov">workflow · analysed {result.folder}</div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The model the user selects for the workflow. There is no implicit default —
 * a workflow only runs once a model is explicitly chosen (`selected`).
 */
function useWorkflowModel() {
  const [model, setModel] = useState<BrainModelSelection | undefined>(undefined);
  const select = useCallback((nextProvider: string, nextModelId: string) => {
    setModel({ provider: nextProvider, modelId: nextModelId });
  }, []);
  return {
    model,
    provider: model?.provider,
    modelId: model?.modelId,
    selected: model !== undefined,
    select,
  };
}

export function PortfolioPage({ api, workspaceFolder, runtime }: PageProps) {
  const { model, provider, modelId, selected: modelReady, select } = useWorkflowModel();
  const { result, busy, choose, useWorkspace, rerun } = useBrainReport(
    api,
    "portfolio",
    workspaceFolder,
    model,
  );
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const portfolio = result?.portfolio;
  const folderReady = result?.chosen === true;
  const canRun = folderReady && modelReady;
  let logoIndex = -1;
  if (openEntity) {
    return (
      <DetailView
        api={api}
        kind="portfolio"
        entity={openEntity}
        workspaceFolder={workspaceFolder}
        runtime={runtime}
        onBack={() => setOpenEntity(null)}
      />
    );
  }
  return (
    <section className="brain" data-testid="brain-portfolio">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Portfolio</h1>
            <p>Holdings against budget, generated by a workflow from the working folder.</p>
          </div>
          <div className="brain__head-controls">
            <ModelSelector
              runtime={runtime}
              provider={provider}
              modelId={modelId}
              thinkingLevel={undefined}
              dropdownPlacement="below"
              onSetModel={select}
              onSetThinking={() => undefined}
            />
            {result?.ranAt ? (
              <span className="brain__asof">Generated {formatRan(result.ranAt)}</span>
            ) : null}
          </div>
        </div>
        <FolderBar
          folder={result?.folder ?? null}
          chosen={folderReady}
          busy={busy}
          canRun={canRun}
          hasResult={Boolean(portfolio)}
          hasWorkspace={workspaceFolder !== null}
          onChoose={choose}
          onUseWorkspace={useWorkspace}
          onRun={rerun}
        />
        {result?.trace ? <Trace steps={result.trace} model={result.model} /> : null}
        {!portfolio ? (
          busy ? (
            <RunningState folder={result?.folder ?? workspaceFolder} />
          ) : result?.needsSetup ? (
            <SetupState folderReady={folderReady} modelReady={modelReady} />
          ) : result ? (
            <EmptyState result={result} />
          ) : null
        ) : (
          <>
            <StatRow stats={portfolio.stats} />
            {portfolio.funds.map((fund) => (
              <div className="brain__card" key={fund.name}>
                <div className="brain__card-head">
                  <div className="grow">
                    <h2>{fund.name}</h2>
                  </div>
                </div>
                <div className="brain__card-sub">
                  {fund.companies.length} positions · ${Math.round(fund.revenue)}M LTM revenue · $
                  {Math.round(fund.ebitda)}M LTM EBITDA
                </div>
                <table className="brain__tbl">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>LTM revenue</th>
                      <th>vs bud</th>
                      <th>LTM EBITDA</th>
                      <th>vs bud</th>
                      <th>EV / EBITDA</th>
                      <th>MOIC</th>
                      <th>IRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fund.companies.map((company) => {
                      logoIndex += 1;
                      return (
                        <tr
                          key={company.name}
                          className="click"
                          onClick={() => setOpenEntity(company.name)}
                        >
                          <td>
                            <div className="co-cell">
                              <span
                                className="co-logo"
                                style={{ background: logoColor(logoIndex) }}
                              >
                                {company.tag}
                              </span>
                              <span>
                                <b>{company.name}</b>
                                <div className="brain__card-sub" style={{ margin: 0 }}>
                                  {company.sector}
                                  {company.held ? ` · ${company.held}` : ""}
                                </div>
                              </span>
                            </div>
                          </td>
                          <td>${company.revenue.toFixed(1)}M</td>
                          <VarianceCell value={company.revVsBudget} />
                          <td>${company.ebitda.toFixed(1)}M</td>
                          <VarianceCell value={company.ebitdaVsBudget} />
                          <td>{company.evMultiple.toFixed(1)}x</td>
                          <td>{company.moic.toFixed(1)}x</td>
                          <td className={company.irr >= 0 ? "num-pos" : "num-neg"}>
                            {signedPct(company.irr)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            {result?.folder ? (
              <div className="brain__prov">workflow · analysed {result.folder}</div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function formatRan(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleString();
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function VarianceCell({ value }: { readonly value: number | null }) {
  if (value === null) return <td className="cell-muted">—</td>;
  return <td className={value >= 0 ? "num-pos" : "num-neg"}>{signedPct(value)}</td>;
}

function DealCard({
  deal,
  index,
  onOpen,
}: {
  readonly deal: BrainDeal;
  readonly index: number;
  readonly onOpen: () => void;
}) {
  return (
    <button className="deal-card deal-card--click" type="button" onClick={onOpen}>
      <div className="deal-card__top">
        <span className="deal-card__logo" style={{ background: logoColor(index) }}>
          {deal.tag}
        </span>
        <div className="grow">
          <div className="agent-row__title">{deal.name}</div>
          <div className="brain__card-sub" style={{ margin: "2px 0 0" }}>
            {deal.sector}
          </div>
        </div>
        <span className={`brain__pill ${deal.statusTone}`}>
          <span className="ic">{deal.statusTone === "good" ? "✓" : "!"}</span>
          {deal.status}
        </span>
      </div>
      <div className="deal-card__metrics">
        <div>
          <div className="k">Enterprise value</div>
          <div className="v">{money0(deal.ev)}</div>
        </div>
        <div>
          <div className="k">Entry multiple</div>
          <div className="v">{deal.entryMultiple.toFixed(1)}x</div>
        </div>
        <div>
          <div className="k">Equity cheque</div>
          <div className="v">{money0(deal.equityCheque)}</div>
        </div>
      </div>
      <div className="stages">
        {DEAL_STAGES.map((stage, stageIndex) => (
          <div
            className={`stage-seg${stageIndex < deal.stageIndex ? " done" : ""}${
              stageIndex === deal.stageIndex ? " now" : ""
            }`}
            key={stage}
          >
            <div className="rulebar" />
            <div className="lab">{stage}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

export function DealsPage({ api, workspaceFolder, runtime }: PageProps) {
  const { model, provider, modelId, selected: modelReady, select } = useWorkflowModel();
  const { result, busy, choose, useWorkspace, rerun } = useBrainReport(
    api,
    "deals",
    workspaceFolder,
    model,
  );
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const deals = result?.deals;
  const folderReady = result?.chosen === true;
  const canRun = folderReady && modelReady;
  if (openEntity) {
    return (
      <DetailView
        api={api}
        kind="deals"
        entity={openEntity}
        workspaceFolder={workspaceFolder}
        runtime={runtime}
        onBack={() => setOpenEntity(null)}
      />
    );
  }
  return (
    <section className="brain" data-testid="brain-deals">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Deals</h1>
            <p>
              Active pipeline by value and stage, generated by a workflow from the working folder.
            </p>
          </div>
          <div className="brain__head-controls">
            <ModelSelector
              runtime={runtime}
              provider={provider}
              modelId={modelId}
              thinkingLevel={undefined}
              dropdownPlacement="below"
              onSetModel={select}
              onSetThinking={() => undefined}
            />
            {result?.ranAt ? (
              <span className="brain__asof">Generated {formatRan(result.ranAt)}</span>
            ) : null}
          </div>
        </div>
        <FolderBar
          folder={result?.folder ?? null}
          chosen={folderReady}
          busy={busy}
          canRun={canRun}
          hasResult={Boolean(deals)}
          hasWorkspace={workspaceFolder !== null}
          onChoose={choose}
          onUseWorkspace={useWorkspace}
          onRun={rerun}
        />
        {result?.trace ? <Trace steps={result.trace} model={result.model} /> : null}
        {!deals ? (
          busy ? (
            <RunningState folder={result?.folder ?? workspaceFolder} />
          ) : result?.needsSetup ? (
            <SetupState folderReady={folderReady} modelReady={modelReady} />
          ) : result ? (
            <EmptyState result={result} />
          ) : null
        ) : (
          <>
            <StatRow stats={deals.stats} />
            <div className="brain__grid cards">
              {deals.deals.map((deal, index) => (
                <DealCard
                  deal={deal}
                  index={index}
                  key={deal.name}
                  onOpen={() => setOpenEntity(deal.name)}
                />
              ))}
            </div>
            {result?.folder ? (
              <div className="brain__prov">workflow · analysed {result.folder}</div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

interface AgentsPageProps {
  readonly scheduledTasks: readonly ScheduledTaskRecord[];
  readonly sessions: readonly SessionRecord[];
}

function formatSchedule(task: ScheduledTaskRecord): string {
  const parts: string[] = [];
  if (task.nextRunAt) parts.push(`next run ${new Date(task.nextRunAt).toLocaleString()}`);
  else if (task.lastRunAt) parts.push(`last run ${new Date(task.lastRunAt).toLocaleString()}`);
  return parts.join(" · ") || task.status;
}

export function AgentsPage({ scheduledTasks, sessions }: AgentsPageProps) {
  const running = sessions.filter((session) => session.status === "running");
  const empty = scheduledTasks.length === 0 && running.length === 0;
  return (
    <section className="brain" data-testid="brain-agents">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Agents</h1>
            <p>Threads running now and the scheduled tasks this workspace runs.</p>
          </div>
        </div>
        {empty ? (
          <div className="brain__empty">
            <b>No active agents.</b>
            <br />
            Running threads and scheduled tasks appear here. Start a thread from Ask, or schedule a
            task.
          </div>
        ) : (
          <div className="brain__card">
            {running.map((session) => (
              <div className="agent-row" key={`run-${session.id}`}>
                <span className="agent-row__icon">
                  <AgentsIcon />
                </span>
                <div className="grow">
                  <div className="agent-row__title">{session.title || "Untitled thread"}</div>
                  <div className="agent-row__note">Thread running now.</div>
                </div>
                <span className="brain__pill good">
                  <span className="ic">●</span>Running
                </span>
              </div>
            ))}
            {scheduledTasks.map((task) => (
              <div className="agent-row" key={`task-${task.id}`}>
                <span className="agent-row__icon">
                  <AgentsIcon />
                </span>
                <div className="grow">
                  <div className="agent-row__title">{task.title}</div>
                  <div className="agent-row__note">{task.instruction}</div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className={`brain__pill ${task.status === "active" ? "good" : "warning"}`}>
                    <span className="ic">{task.status === "active" ? "✓" : "○"}</span>
                    {task.status}
                  </span>
                  <div className="brain__card-sub" style={{ margin: "4px 0 0" }}>
                    {formatSchedule(task)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
