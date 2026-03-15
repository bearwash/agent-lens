// ─── Claude Code Session Detector ───
// Detects Claude Code session metadata from MCP handshake messages
// and auto-configures cost tracking based on the detected model.

import type { McpRequest, McpResponse, ModelPricing } from "@agent-lens/protocol";
import { DEFAULT_PRICING } from "@agent-lens/protocol";
import { findPricing } from "@agent-lens/otel-config";

export interface ClaudeCodeSessionInfo {
  /** Whether the connected client is Claude Code */
  isClaudeCode: boolean;
  /** Claude Code version string if detected */
  clientVersion?: string;
  /** The model being used (e.g. "claude-opus-4-6") */
  model?: string;
  /** Working directory of the Claude Code session */
  workingDirectory?: string;
  /** Project name derived from the working directory */
  projectName?: string;
  /** Platform information (e.g. "win32", "darwin", "linux") */
  platform?: string;
  /** Shell being used (e.g. "bash", "zsh", "powershell") */
  shell?: string;
  /** Pricing info for the detected model */
  pricing?: ModelPricing;
  /** Raw client info from the handshake */
  rawClientInfo?: Record<string, unknown>;
}

/**
 * Detects Claude Code as the MCP client from the `initialize` request.
 *
 * Claude Code sends an `initialize` request with client info in the params.
 * This function inspects those params to determine if the client is Claude Code
 * and extracts relevant session metadata.
 */
export function detectClaudeCodeSession(request: McpRequest): ClaudeCodeSessionInfo | null {
  if (request.method !== "initialize") {
    return null;
  }

  const params = request.params ?? {};
  const clientInfo = params.clientInfo as Record<string, unknown> | undefined;

  if (!clientInfo) {
    return null;
  }

  const clientName = String(clientInfo.name ?? "").toLowerCase();
  const isClaudeCode =
    clientName.includes("claude") ||
    clientName.includes("claude-code") ||
    clientName.includes("claude_code");

  if (!isClaudeCode) {
    return null;
  }

  const clientVersion = clientInfo.version != null ? String(clientInfo.version) : undefined;

  // Extract model from capabilities or metadata
  const model = extractModel(params);
  const workingDirectory = extractWorkingDirectory(params);
  const projectName = workingDirectory
    ? workingDirectory.split(/[/\\]/).filter(Boolean).pop()
    : undefined;
  const platform = extractStringField(params, "platform");
  const shell = extractStringField(params, "shell");

  // Look up pricing for cost tracking
  const pricing = model ? findPricing(model) : undefined;

  return {
    isClaudeCode: true,
    clientVersion,
    model,
    workingDirectory,
    projectName,
    platform,
    shell,
    pricing,
    rawClientInfo: clientInfo,
  };
}

/**
 * Extracts model information from various locations in the MCP params.
 * Claude Code may pass model info in different fields depending on the version.
 */
function extractModel(params: Record<string, unknown>): string | undefined {
  // Direct model field
  if (typeof params.model === "string") return params.model;

  // Nested in clientInfo
  const clientInfo = params.clientInfo as Record<string, unknown> | undefined;
  if (clientInfo && typeof clientInfo.model === "string") return clientInfo.model;

  // In capabilities metadata
  const capabilities = params.capabilities as Record<string, unknown> | undefined;
  if (capabilities) {
    if (typeof capabilities.model === "string") return capabilities.model;
    const experimental = capabilities.experimental as Record<string, unknown> | undefined;
    if (experimental && typeof experimental.model === "string") return experimental.model;
  }

  // In metadata
  const metadata = params.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata.model === "string") return metadata.model;

  return undefined;
}

/**
 * Extracts the working directory from MCP params.
 */
function extractWorkingDirectory(params: Record<string, unknown>): string | undefined {
  // Check common field names
  for (const key of ["workingDirectory", "cwd", "rootDir", "projectRoot", "rootUri"]) {
    if (typeof params[key] === "string") return params[key] as string;
  }

  // Check nested in clientInfo
  const clientInfo = params.clientInfo as Record<string, unknown> | undefined;
  if (clientInfo) {
    for (const key of ["workingDirectory", "cwd", "rootDir"]) {
      if (typeof clientInfo[key] === "string") return clientInfo[key] as string;
    }
  }

  // Check in metadata/roots
  const metadata = params.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    for (const key of ["workingDirectory", "cwd"]) {
      if (typeof metadata[key] === "string") return metadata[key] as string;
    }
  }

  return undefined;
}

/**
 * Extracts a string field by checking multiple common locations.
 */
function extractStringField(params: Record<string, unknown>, field: string): string | undefined {
  if (typeof params[field] === "string") return params[field] as string;

  const clientInfo = params.clientInfo as Record<string, unknown> | undefined;
  if (clientInfo && typeof clientInfo[field] === "string") return clientInfo[field] as string;

  const metadata = params.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata[field] === "string") return metadata[field] as string;

  return undefined;
}

/**
 * Builds a cost tracker function for the detected model.
 * Returns a function that computes USD cost given token counts.
 */
export function createCostTracker(
  sessionInfo: ClaudeCodeSessionInfo,
): (inputTokens: number, outputTokens: number) => { inputUsd: number; outputUsd: number; totalUsd: number } {
  const pricing = sessionInfo.pricing;

  if (!pricing) {
    return () => ({ inputUsd: 0, outputUsd: 0, totalUsd: 0 });
  }

  return (inputTokens: number, outputTokens: number) => {
    const inputUsd = (inputTokens / 1_000_000) * pricing.inputPricePerMToken;
    const outputUsd = (outputTokens / 1_000_000) * pricing.outputPricePerMToken;
    return { inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
  };
}

/**
 * Enriches an MCP initialize response with Agent Lens server info
 * so Claude Code knows it's connected through a proxy.
 */
export function enrichInitializeResponse(
  response: McpResponse,
  proxyPort: number,
): McpResponse {
  const result = (response.result ?? {}) as Record<string, unknown>;

  return {
    ...response,
    result: {
      ...result,
      serverInfo: {
        ...(result.serverInfo as Record<string, unknown> | undefined),
        name: "agent-lens-proxy",
        version: "0.1.0",
        proxyPort,
      },
    },
  };
}

/**
 * Get all supported model IDs for auto-detection.
 */
export function getSupportedModels(): string[] {
  return DEFAULT_PRICING.map((p) => p.model);
}
