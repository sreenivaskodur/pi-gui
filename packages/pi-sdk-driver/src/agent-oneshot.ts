import { join } from "node:path";
import {
  SessionManager,
  SettingsManager,
  createExtensionRuntime,
  createAgentSession,
  ModelRuntime,
  type CreateAgentSessionOptions,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import type { SessionModelSelection, WorkspaceRef } from "@pi-gui/session-driver";
import { messageText as sessionMessageText } from "./session-supervisor-utils.js";

/*
 * A single-turn agent reply: run one prompt against a workspace with a custom
 * system prompt and return the assistant's final text. No tools and no session
 * persistence — this is the mechanism behind on-demand "workflow" pages that
 * ask the model to produce a structured result. Mirrors the thread-title
 * generator, generalised to any system prompt.
 */

export interface AgentOneShotOptions {
  readonly systemPrompt: string;
  readonly prompt: string;
  readonly model?: SessionModelSelection;
  readonly thinkingLevel?: string;
  readonly signal?: AbortSignal;
}

export interface AgentOneShotDeps {
  readonly agentDir: string;
}

export interface AgentOneShotResult {
  readonly text: string | null;
  /** A reason the reply could not be produced, for surfacing to the user. */
  readonly error?: string;
}

export async function generateAgentReply(
  workspace: WorkspaceRef,
  options: AgentOneShotOptions,
  deps: AgentOneShotDeps,
): Promise<AgentOneShotResult> {
  if (options.signal?.aborted) return { text: null, error: "Cancelled." };

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
  });
  const modelRuntime = await ModelRuntime.create({
    authPath: join(deps.agentDir, "auth.json"),
    modelsPath: join(deps.agentDir, "models.json"),
    refreshOnCreate: false,
  });
  await modelRuntime.refresh({ allowNetwork: false });

  const createOptions: CreateAgentSessionOptions = {
    cwd: workspace.path,
    agentDir: deps.agentDir,
    modelRuntime,
    resourceLoader: createOneShotResourceLoader(options.systemPrompt),
    settingsManager,
    sessionManager: SessionManager.inMemory(),
    tools: [],
  };
  const selected =
    options.model && modelRuntime.getModel(options.model.provider, options.model.modelId);
  const fallback = selected ? undefined : (await modelRuntime.getAvailable())[0];
  const model = selected || fallback;
  if (!model) {
    return {
      text: null,
      error: "No model is connected. Connect a provider in Settings → Providers, then retry.",
    };
  }
  createOptions.model = model;
  if (options.thinkingLevel) {
    createOptions.thinkingLevel = options.thinkingLevel as NonNullable<
      CreateAgentSessionOptions["thinkingLevel"]
    >;
  }

  const { session } = await createAgentSession(createOptions);
  const handleAbort = () => {
    void session.abort().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", handleAbort, { once: true });
  try {
    if (!session.model) return { text: null, error: "No model is available." };
    await session.prompt(options.prompt, { source: "interactive" });
    return { text: extractLastAssistantText(session) };
  } catch (error) {
    return { text: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    options.signal?.removeEventListener("abort", handleAbort);
    session.dispose();
  }
}

function createOneShotResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function extractLastAssistantText(session: { messages: readonly unknown[] }): string {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (typeof message !== "object" || message === null) continue;
    if ((message as { role?: unknown }).role !== "assistant") continue;
    return sessionMessageText(message as Record<string, unknown>);
  }
  return "";
}
