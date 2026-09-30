import { AgentsIcon } from "../../ui/icons";
import {
  AGENTS,
  DEAL_STAGES,
  DEALS,
  PORTFOLIO_FUNDS,
  type Deal,
  type PortfolioCompany,
} from "./brain-data";

/*
 * The app's own Portfolio, Deals and Agents pages — the True Wind prototype's
 * section layouts, rendered from the active theme. Representative demo data
 * lives in brain-data.ts; the live computed dashboards are a separate tab.
 */

// Fixed navy/slate ramp for the brand chips — dark enough for white text in
// both light and dark themes, and on-palette with the single-blue design.
const LOGO_COLORS = ["#1c5cab", "#2a78d6", "#0d366b", "#334155"];
const money = (value: number) => `$${value.toFixed(1)}M`;
const money0 = (value: number) => `$${Math.round(value)}M`;
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

function DemoBanner() {
  return (
    <div className="brain__prov" style={{ marginTop: 0, marginBottom: 18, borderTop: "none" }}>
      Demo data. Every company, deal, figure and agent in these pages is invented; live computed
      dashboards come from the Dashboards tab.
    </div>
  );
}

function VarianceCell({ value }: { readonly value: number }) {
  return <td className={value >= 0 ? "num-pos" : "num-neg"}>{signed(value)}</td>;
}

function logoColor(index: number): string {
  return LOGO_COLORS[index % LOGO_COLORS.length]!;
}

export function PortfolioPage() {
  return (
    <section className="brain" data-testid="brain-portfolio">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Portfolio</h1>
            <p>
              Positions across two funds. Operating figures are the latest actuals against the FY26
              board-approved budget.
            </p>
          </div>
          <span className="brain__asof">Marks as of Jun 2026</span>
        </div>
        <DemoBanner />
        {PORTFOLIO_FUNDS.map((fund) => {
          const revenue = fund.companies.reduce((sum, company) => sum + company.revenue, 0);
          const ebitda = fund.companies.reduce((sum, company) => sum + company.ebitda, 0);
          let logoIndex = -1;
          return (
            <div className="brain__card" key={fund.name}>
              <div className="brain__card-head">
                <div className="grow">
                  <h2>{fund.name}</h2>
                </div>
                <span className="brain__card-sub" style={{ margin: 0 }}>
                  {fund.vintage}
                </span>
              </div>
              <div className="brain__card-sub">
                {fund.companies.length} positions · {money(revenue)} LTM revenue · {money(ebitda)}{" "}
                LTM EBITDA
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
                  {fund.companies.map((company: PortfolioCompany) => {
                    logoIndex += 1;
                    return (
                      <tr key={company.name}>
                        <td>
                          <div className="co-cell">
                            <span className="co-logo" style={{ background: logoColor(logoIndex) }}>
                              {company.tag}
                            </span>
                            <span>
                              <b>{company.name}</b>
                              <div className="brain__card-sub" style={{ margin: 0 }}>
                                {company.sector} · {company.held}
                              </div>
                            </span>
                          </div>
                        </td>
                        <td>{money(company.revenue)}</td>
                        <VarianceCell value={company.revVsBudget} />
                        <td>{money(company.ebitda)}</td>
                        <VarianceCell value={company.ebitdaVsBudget} />
                        <td>{company.evMultiple.toFixed(1)}x</td>
                        <td>{company.moic.toFixed(1)}x</td>
                        <td className={company.irr >= 0 ? "num-pos" : "num-neg"}>
                          {signed(company.irr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DealCard({ deal, index }: { readonly deal: Deal; readonly index: number }) {
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

export function DealsPage() {
  const combined = DEALS.reduce((sum, deal) => sum + deal.ev, 0);
  return (
    <section className="brain" data-testid="brain-deals">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Deals</h1>
            <p>Active opportunities by enterprise value and stage.</p>
          </div>
          <span className="brain__asof">Pipeline reviewed this week</span>
        </div>
        <DemoBanner />
        <div className="brain__stats">
          <div className="brain__stat">
            <div className="k">Active deals</div>
            <div className="v">{DEALS.length}</div>
          </div>
          <div className="brain__stat">
            <div className="k">Combined EV</div>
            <div className="v">{money0(combined)}</div>
          </div>
          <div className="brain__stat">
            <div className="k">In exclusivity</div>
            <div className="v">{DEALS.filter((deal) => deal.stageIndex >= 3).length}</div>
          </div>
          <div className="brain__stat">
            <div className="k">Median entry</div>
            <div className="v">
              {DEALS.map((deal) => deal.entryMultiple)
                .sort((a, b) => a - b)
                [Math.floor(DEALS.length / 2)]!.toFixed(1)}
              x
            </div>
          </div>
        </div>
        <div className="brain__grid cards">
          {DEALS.map((deal, index) => (
            <DealCard deal={deal} index={index} key={deal.name} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function AgentsPage() {
  return (
    <section className="brain" data-testid="brain-agents">
      <div className="brain__pad">
        <div className="brain__head">
          <div className="grow">
            <h1>Agents</h1>
            <p>The agents this brain can run, on demand or on a schedule.</p>
          </div>
        </div>
        <DemoBanner />
        <div className="brain__card">
          {AGENTS.map((agent) => (
            <div className="agent-row" key={agent.name}>
              <span className="agent-row__icon">
                <AgentsIcon />
              </span>
              <div className="grow">
                <div className="agent-row__title">{agent.name}</div>
                <div className="agent-row__note">{agent.detail}</div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span className={`brain__pill ${agent.statusTone}`}>
                  <span className="ic">{agent.statusTone === "good" ? "✓" : "○"}</span>
                  {agent.status}
                </span>
                <div className="brain__card-sub" style={{ margin: "4px 0 0" }}>
                  {agent.kind} · {agent.lastRun}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
