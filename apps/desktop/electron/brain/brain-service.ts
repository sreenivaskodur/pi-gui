import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, isAbsolute, join } from "node:path";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import { generateAgentReply } from "@pi-gui/pi-sdk-driver";
import {
  BRAIN_SYSTEM_PROMPT,
  buildBrainPrompt,
  extractJsonObject,
  parseBrainDeals,
  parseBrainPortfolio,
  type BrainComputeResult,
  type BrainFolderState,
  type BrainReportKind,
} from "../../contracts/brain";

/*
 * Main-process brain workflow service. Portfolio and Deals are preset-prompt
 * workflows: the service gathers a bounded snapshot of the working folder,
 * asks the model to return the report as JSON, validates it, and caches the
 * result. The working folder is the user's explicit choice, or the open
 * workspace folder the renderer supplies. No specific file is required.
 */

const TEXT_EXTENSIONS = new Set([".csv", ".tsv", ".json", ".md", ".txt", ".yaml", ".yml"]);
const MAX_FILES = 12;
const MAX_FILE_BYTES = 8_192;
const MAX_SNAPSHOT_BYTES = 48_000;

export class BrainService {
  private chosenFolder: string | null = null;
  private readonly folderStatePath: string;
  private readonly cachePath: string;
  private cache = new Map<string, BrainComputeResult>();

  constructor(
    userDataDir: string,
    private readonly agentDir: string,
  ) {
    this.folderStatePath = join(userDataDir, "brain-data-folder.json");
    this.cachePath = join(userDataDir, "brain-reports-cache.json");
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
    this.persistFolder();
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

  /** Returns the cached result if present; runs the workflow otherwise. */
  async compute(
    kind: BrainReportKind,
    workspaceFolder: string | null,
    options: { readonly rerun?: boolean; readonly signal?: AbortSignal } = {},
  ): Promise<BrainComputeResult> {
    const folder = this.chosenFolder ?? workspaceFolder;
    const base: BrainComputeResult = { kind, folder, chosen: this.chosenFolder !== null };
    if (!folder) {
      return { ...base, error: "Choose a working folder for the brain to analyse." };
    }
    const key = `${kind}:${folder}`;
    if (!options.rerun) {
      const cached = this.cache.get(key);
      if (cached) return cached;
    }
    let snapshot: string;
    try {
      snapshot = this.snapshotFolder(folder);
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message : String(error) };
    }
    const reply = await generateAgentReply(
      { path: folder, workspaceId: folder },
      {
        systemPrompt: BRAIN_SYSTEM_PROMPT,
        prompt: buildBrainPrompt(kind, snapshot),
        signal: options.signal,
      },
      { agentDir: this.agentDir },
    );
    if (!reply.text) {
      return { ...base, error: reply.error ?? "The model returned no output." };
    }
    let result: BrainComputeResult;
    try {
      const json = extractJsonObject(reply.text);
      result =
        kind === "portfolio"
          ? { ...base, ranAt: new Date().toISOString(), portfolio: parseBrainPortfolio(json) }
          : { ...base, ranAt: new Date().toISOString(), deals: parseBrainDeals(json) };
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message : String(error) };
    }
    this.cache.set(key, result);
    this.persistCache();
    return result;
  }

  /** A bounded, readable snapshot of the folder's top-level data files. */
  private snapshotFolder(folder: string): string {
    let entries: string[];
    try {
      entries = readdirSync(folder);
    } catch {
      return "";
    }
    const parts: string[] = [];
    let total = 0;
    let included = 0;
    for (const name of entries.sort()) {
      if (included >= MAX_FILES || total >= MAX_SNAPSHOT_BYTES) break;
      const path = join(folder, name);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (!stat.isFile() || !TEXT_EXTENSIONS.has(extname(name).toLowerCase())) continue;
      let text: string;
      try {
        text = readFileSync(path, "utf8").slice(0, MAX_FILE_BYTES);
      } catch {
        continue;
      }
      const block = `=== ${name} ===\n${text}`;
      parts.push(block);
      total += block.length;
      included += 1;
    }
    return parts.join("\n\n").slice(0, MAX_SNAPSHOT_BYTES);
  }

  private restore(): void {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.folderStatePath, "utf8"));
      if (isRecord(parsed) && typeof parsed.folder === "string") {
        const stored = parsed.folder;
        if (existsSync(stored) && statSync(stored).isDirectory()) this.chosenFolder = stored;
      }
    } catch {
      // No stored folder yet; follow the workspace folder.
    }
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.cachePath, "utf8"));
      if (isRecord(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (isRecord(value)) this.cache.set(key, value as unknown as BrainComputeResult);
        }
      }
    } catch {
      // No cache yet.
    }
  }

  private persistFolder(): void {
    try {
      writeFileSync(this.folderStatePath, `${JSON.stringify({ folder: this.chosenFolder })}\n`);
    } catch {
      // Best-effort.
    }
  }

  private persistCache(): void {
    try {
      mkdirSync(join(this.cachePath, ".."), { recursive: true });
      const payload = Object.fromEntries(this.cache);
      const temporary = `${this.cachePath}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(payload)}\n`);
      renameSync(temporary, this.cachePath);
    } catch {
      // Best-effort.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
