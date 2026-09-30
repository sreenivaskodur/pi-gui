import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import {
  BRAIN_DATASETS,
  computeDeals,
  computePortfolio,
  type BrainComputeResult,
  type BrainFolderState,
  type BrainReportKind,
} from "../../contracts/brain";

/*
 * Main-process brain data service. The Portfolio and Deals pages read their
 * CSVs from a working folder — the folder the user explicitly picks, or, when
 * they haven't, the open workspace folder the renderer supplies. Nothing is
 * bundled with the app; the data always comes from that folder. The chosen
 * override persists in the user data dir.
 */
export class BrainService {
  private chosenFolder: string | null = null;
  private readonly statePath: string;

  constructor(userDataDir: string) {
    this.statePath = join(userDataDir, "brain-data-folder.json");
    this.restore();
  }

  folderState(): BrainFolderState {
    return { chosenFolder: this.chosenFolder };
  }

  setFolder(folder: string | null): BrainFolderState {
    if (folder !== null) {
      if (!isAbsolute(folder)) throw new Error("The working folder must be an absolute path.");
      if (!existsSync(folder) || !statSync(folder).isDirectory()) {
        throw new Error(`Not a folder: ${folder}`);
      }
    }
    this.chosenFolder = folder;
    this.persist();
    return this.folderState();
  }

  async pickFolder(window: BrowserWindow | undefined): Promise<BrainFolderState> {
    const result = await (window
      ? dialog.showOpenDialog(window, {
          properties: ["openDirectory"],
          title: "Choose data folder",
        })
      : dialog.showOpenDialog({ properties: ["openDirectory"], title: "Choose data folder" }));
    const chosen = result.canceled ? undefined : result.filePaths[0];
    if (chosen) this.setFolder(chosen);
    return this.folderState();
  }

  compute(kind: BrainReportKind, workspaceFolder: string | null): BrainComputeResult {
    const folder = this.chosenFolder ?? workspaceFolder;
    const dataset = BRAIN_DATASETS[kind];
    const base: BrainComputeResult = { kind, dataset, folder, chosen: this.chosenFolder !== null };
    if (!folder) {
      return {
        ...base,
        error: `Choose a working folder that contains ${dataset}.`,
      };
    }
    const dataPath = join(folder, dataset);
    if (!existsSync(dataPath)) {
      return {
        ...base,
        error: `${dataset} not found in ${folder}. Choose a folder that contains ${dataset}.`,
      };
    }
    try {
      const text = readFileSync(dataPath, "utf8");
      if (kind === "portfolio") {
        const portfolio = computePortfolio(text);
        const rows = portfolio.funds.reduce((sum, fund) => sum + fund.companies.length, 0);
        return { ...base, computedFrom: dataPath, rows, portfolio };
      }
      const deals = computeDeals(text);
      return { ...base, computedFrom: dataPath, rows: deals.deals.length, deals };
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private restore(): void {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.statePath, "utf8"));
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { folder?: unknown }).folder === "string"
      ) {
        const stored = (parsed as { folder: string }).folder;
        if (existsSync(stored) && statSync(stored).isDirectory()) this.chosenFolder = stored;
      }
    } catch {
      // No stored folder yet, or it is unreadable; follow the workspace folder.
    }
  }

  private persist(): void {
    try {
      writeFileSync(this.statePath, `${JSON.stringify({ folder: this.chosenFolder })}\n`);
    } catch {
      // Persistence is best-effort; the folder still applies for this session.
    }
  }
}
