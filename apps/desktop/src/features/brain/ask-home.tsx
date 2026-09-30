import type { ComponentType } from "react";
import type { AppView, SessionRecord, WorkspaceRecord } from "../../../contracts/desktop-state";
import { AgentsIcon, DealsIcon, PlusIcon, PortfolioIcon } from "../../ui/icons";
import { formatRelativeTime } from "../../lib/string-utils";

/*
 * The Ask landing — the brain's home. Shown when Ask is active and no thread is
 * open: a hero, a primary "New thread" action, shortcuts into the brain's
 * sections, and a jump-back list of recent threads. Mirrors the prototype's
 * chat hero rather than a bare empty panel.
 */

interface RecentThread {
  readonly workspaceId: string;
  readonly session: SessionRecord;
}

interface AskHomeProps {
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly recentThreads: readonly RecentThread[];
  readonly onNewThread: () => void;
  readonly onOpenView: (view: AppView) => void;
  readonly onSelectSession: (target: { workspaceId: string; sessionId: string }) => void;
}

const SECTIONS: { view: AppView; title: string; sub: string; icon: ComponentType }[] = [
  { view: "portfolio", title: "Portfolio", sub: "Companies against budget", icon: PortfolioIcon },
  { view: "deals", title: "Deals", sub: "Pipeline by value and stage", icon: DealsIcon },
  { view: "agents", title: "Agents", sub: "Running and scheduled work", icon: AgentsIcon },
];

export function AskHome({
  selectedWorkspace,
  recentThreads,
  onNewThread,
  onOpenView,
  onSelectSession,
}: AskHomeProps) {
  return (
    <section className="ask-home" data-testid="ask-home">
      <div className="ask-home__inner">
        <div className="ask-home__eyebrow">Company brain</div>
        <h1 className="ask-home__title">What are we working on?</h1>
        <p className="ask-home__lead">
          {selectedWorkspace
            ? `Start a thread in ${selectedWorkspace.name}, or jump into the brain's sections.`
            : "Open a project folder to start a thread, then explore the brain's sections."}
        </p>

        <button className="ask-home__cta" type="button" onClick={onNewThread}>
          <PlusIcon />
          <span>New thread</span>
        </button>

        <div className="ask-home__sections">
          {SECTIONS.map(({ view, title, sub, icon: SectionIcon }) => (
            <button
              className="ask-home__card"
              type="button"
              key={view}
              onClick={() => onOpenView(view)}
            >
              <span className="ask-home__card-icon">
                <SectionIcon />
              </span>
              <span className="ask-home__card-copy">
                <span className="ask-home__card-title">{title}</span>
                <span className="ask-home__card-sub">{sub}</span>
              </span>
            </button>
          ))}
        </div>

        {recentThreads.length > 0 ? (
          <div className="ask-home__recent">
            <div className="ask-home__recent-label">Continue</div>
            {recentThreads.map(({ workspaceId, session }) => (
              <button
                className="ask-home__recent-row"
                type="button"
                key={`${workspaceId}:${session.id}`}
                onClick={() => onSelectSession({ workspaceId, sessionId: session.id })}
              >
                <span className="ask-home__recent-title">{session.title || "Untitled thread"}</span>
                <span className="ask-home__recent-time">
                  {formatRelativeTime(session.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
