import { useCallback, useEffect, useState } from "react";
import type {
  BrainComputeResult,
  BrainDeal,
  BrainReportKind,
  BrainStat,
} from "../../../contracts/brain";
import { DEAL_STAGES, money0 } from "../../../contracts/brain";
import type { PiDesktopApi } from "../../../contracts/ipc";
import type { ScheduledTaskRecord, SessionRecord } from "../../../contracts/desktop-state";
import { AgentsIcon } from "../../ui/icons";

/*
 * The Ask/Portfolio/Deals/Agents section pages. Portfolio and Deals compute
 * live from CSVs in the working folder (companies.csv, pipeline.csv) via the
 * brainCompute IPC; Agents reflects the session's real scheduled tasks and
 * running threads. Nothing here is static demo data.
 */

// Fixed navy/slate ramp for the brand chips — dark enough for white text in
// both light and dark themes, and on-palette with the single-blue design.
const LOGO_COLORS = ["#1c5cab", "#2a78d6", "#0d366b", "#334155"];
const logoColor = (index: number) => LOGO_COLORS[index % LOGO_COLORS.length]!;

interface PageProps {
  readonly api: PiDesktopApi;
  readonly workspaceFolder: string | null;
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
  result,
  busy,
  onChoose,
  onReset,
}: {
  readonly result: BrainComputeResult | null;
  readonly busy: boolean;
  readonly onChoose: () => void;
  readonly onReset: () => void;
}) {
  return (
    <div className="brain__folderbar">
      <span className="brain__folderbar-lab">Working folder</span>
      <code className="brain__folder-path" title={result?.folder ?? undefined}>
        {result?.folder ?? "None selected"}
      </code>
      {result?.dataset ? <span className="brain__folder-tag">reads {result.dataset}</span> : null}
      <button className="brain__link-btn" type="button" disabled={busy} onClick={onChoose}>
        Choose folder…
      </button>
      {result?.chosen ? (
        <button className="brain__link-btn" type="button" disabled={busy} onClick={onReset}>
          Use workspace folder
        </button>
      ) : null}
    </div>
  );
}

function useBrainReport(api: PiDesktopApi, kind: BrainReportKind, workspaceFolder: string | null) {
  const [result, setResult] = useState<BrainComputeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const compute = useCallback(() => {
    let cancelled = false;
    setBusy(true);
    api
      .brainCompute(kind, workspaceFolder)
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            kind,
            dataset: kind === "portfolio" ? "companies.csv" : "pipeline.csv",
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
  }, [api, kind, workspaceFolder]);
  useEffect(() => compute(), [compute]);
  const choose = useCallback(() => {
    setBusy(true);
    api
      .brainPickDataFolder()
      .then(() => compute())
      .catch(() => setBusy(false));
  }, [api, compute]);
  const reset = useCallback(() => {
    setBusy(true);
    api
      .brainSetDataFolder(null)
      .then(() => compute())
      .catch(() => setBusy(false));
  }, [api, compute]);
  return { result, busy, choose, reset };
}

function EmptyState({ result }: { readonly result: BrainComputeResult }) {
  return (
    <div className="brain__empty">
      <b>No data yet.</b>
      <br />
      {result.error ?? `Choose a folder containing ${result.dataset}.`}
    </div>
  );
}

export function PortfolioPage({ api, workspaceFolder }: PageProps) {
  const { result, busy, choose, reset } = useBrainReport(api, "portfolio", workspaceFolder);
  const portfolio = result?.portfolio;
  let logoIndex = -1;
  return (
    <section className="brain" data-testid="brain-portfolio">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Portfolio</h1>
            <p>Each company against its EBITDA budget, computed from companies.csv.</p>
          </div>
          {result?.rows ? (
            <span className="brain__asof">
              {result.rows} companies · from {result.dataset}
            </span>
          ) : null}
        </div>
        <FolderBar result={result} busy={busy} onChoose={choose} onReset={reset} />
        {!portfolio ? (
          result ? (
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
                        <tr key={company.name}>
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
            {result?.computedFrom ? (
              <div className="brain__prov">computed from {result.computedFrom}</div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function VarianceCell({ value }: { readonly value: number | null }) {
  if (value === null) return <td className="cell-muted">—</td>;
  return <td className={value >= 0 ? "num-pos" : "num-neg"}>{signedPct(value)}</td>;
}

function DealCard({ deal, index }: { readonly deal: BrainDeal; readonly index: number }) {
  return (
    <div className="deal-card">
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
    </div>
  );
}

export function DealsPage({ api, workspaceFolder }: PageProps) {
  const { result, busy, choose, reset } = useBrainReport(api, "deals", workspaceFolder);
  const deals = result?.deals;
  return (
    <section className="brain" data-testid="brain-deals">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Deals</h1>
            <p>Active opportunities by enterprise value and stage, computed from pipeline.csv.</p>
          </div>
          {result?.rows ? (
            <span className="brain__asof">
              {result.rows} deals · from {result.dataset}
            </span>
          ) : null}
        </div>
        <FolderBar result={result} busy={busy} onChoose={choose} onReset={reset} />
        {!deals ? (
          result ? (
            <EmptyState result={result} />
          ) : null
        ) : (
          <>
            <StatRow stats={deals.stats} />
            <div className="brain__grid cards">
              {deals.deals.map((deal, index) => (
                <DealCard deal={deal} index={index} key={deal.name} />
              ))}
            </div>
            {result?.computedFrom ? (
              <div className="brain__prov">computed from {result.computedFrom}</div>
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
