// ─── Claude Code Adapter for Agent Lens ───
// Provides native Claude Code support so Agent Lens can observe and debug
// Claude Code sessions via MCP proxy.

import type {
  McpRequest,
  McpResponse,
  AgentSpan,
} from "@agent-lens/protocol";
import {
  createToolCallSpan,
  createThinkingSpan,
  completeSpanWithResponse,
  enrichSpanWithCost,
  GenAIAttributes,
  AgentLensAttributes,
} from "@agent-lens/otel-config";
import {
  getToolMapping,
  getSpanName,
  getRiskLevel,
  generateDefaultApprovalRules,
  type ToolMapping,
  type ToolCategory,
} from "./tool-mapper.js";
import {
  detectClaudeCodeSession,
  createCostTracker,
  enrichInitializeResponse,
  getSupportedModels,
  type ClaudeCodeSessionInfo,
} from "./session-detector.js";

// ─── Re-exports ───

export {
  getToolMapping,
  getSpanName,
  getRiskLevel,
  generateDefaultApprovalRules,
  detectClaudeCodeSession,
  createCostTracker,
  enrichInitializeResponse,
  getSupportedModels,
};
export type { ToolMapping, ToolCategory, ClaudeCodeSessionInfo };

// ─── MCP Client Configuration ───

export interface AgentLensProxyConfig {
  /** Host where Agent Lens proxy is running */
  host: string;
  /** Port where Agent Lens proxy is running */
  port: number;
  /** Protocol to use */
  protocol: "stdio" | "sse" | "streamable-http";
}

/**
 * Creates the MCP client settings that point to Agent Lens proxy.
 * Use these settings when configuring Claude Code to route through Agent Lens.
 */
export function createClaudeCodeConfig(
  options: Partial<AgentLensProxyConfig> = {},
): AgentLensProxyConfig {
  return {
    host: options.host ?? "localhost",
    port: options.port ?? 5173,
    protocol: options.protocol ?? "stdio",
  };
}

/**
 * Generates the JSON configuration that users add to Claude Code's
 * MCP settings file to route tool calls through Agent Lens.
 *
 * Users should add this to their `.claude/settings.json` or
 * `claude_code_config.json` file.
 */
export function generateMcpConfig(options: {
  proxyCommand?: string;
  proxyArgs?: string[];
  targetCommand: string;
  targetArgs?: string[];
  name?: string;
}): Record<string, unknown> {
  const proxyCommand = options.proxyCommand ?? "npx";
  const proxyArgs = options.proxyArgs ?? ["@agent-lens/proxy"];

  return {
    mcpServers: {
      [options.name ?? "agent-lens"]: {
        command: proxyCommand,
        args: [
          ...proxyArgs,
          "--",
          options.targetCommand,
          ...(options.targetArgs ?? []),
        ],
        env: {},
      },
    },
  };
}

// ─── Permission System Mapping ───

export type ClaudeCodePermission = "auto-approve" | "ask" | "deny";

interface PermissionMapping {
  permission: ClaudeCodePermission;
  shouldGate: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Maps Claude Code's permission system to Agent Lens approval gates.
 *
 * - "auto-approve" → no gate, low risk
 * - "ask" → gate enabled, risk based on tool category
 * - "deny" → always reject, critical risk
 */
export function mapPermissionToApprovalGate(
  toolName: string,
  permission: ClaudeCodePermission,
): PermissionMapping {
  const toolRisk = getRiskLevel(toolName);

  switch (permission) {
    case "auto-approve":
      return { permission, shouldGate: false, riskLevel: "low" };
    case "ask":
      return { permission, shouldGate: true, riskLevel: toolRisk };
    case "deny":
      return { permission, shouldGate: true, riskLevel: "critical" };
  }
}

// ─── Claude Code Adapter ───

/**
 * The main adapter class that processes Claude Code MCP messages
 * and maps them into Agent Lens spans.
 *
 * It handles:
 * - Parsing Claude Code's specific MCP message patterns (tools/call)
 * - Mapping tool names to human-readable span names
 * - Extracting token usage from API responses
 * - Detecting thinking blocks and creating thinking spans
 * - Mapping Claude Code's permission system to approval gates
 */
export class ClaudeCodeAdapter {
  private sessionInfo: ClaudeCodeSessionInfo | null = null;
  private costTracker: ((inputTokens: number, outputTokens: number) => {
    inputUsd: number;
    outputUsd: number;
    totalUsd: number;
  }) | null = null;

  /**
   * Process an incoming MCP request from Claude Code.
   * Returns an enriched span if the request is a tool call,
   * or null for non-tool-call messages.
   */
  processRequest(
    traceId: string,
    parentSpanId: string | undefined,
    mcpServer: string,
    request: McpRequest,
    branchId?: string,
  ): AgentSpan | null {
    // Check for initialize to detect Claude Code
    if (request.method === "initialize") {
      this.sessionInfo = detectClaudeCodeSession(request);
      if (this.sessionInfo) {
        this.costTracker = createCostTracker(this.sessionInfo);
      }
      return null;
    }

    // Only process tool calls
    if (request.method !== "tools/call") {
      return null;
    }

    const toolName = (request.params?.name as string) ?? "unknown";
    const mapping = getToolMapping(toolName);

    // Create the base span via otel-config
    const span = createToolCallSpan(traceId, parentSpanId, mcpServer, request, branchId);

    // Enrich with Claude Code-specific attributes
    span.name = `${mapping.spanName}`;
    span.attributes["gen_ai.system"] = "claude-code";
    span.attributes["agent_lens.claude_code.tool_category"] = mapping.category;
    span.attributes["agent_lens.claude_code.risk_level"] = mapping.riskLevel;

    if (this.sessionInfo?.model) {
      span.attributes[GenAIAttributes.REQUEST_MODEL] = this.sessionInfo.model;
    }

    // Extract file path from tool arguments for file operations
    const filePath = extractFilePath(request);
    if (filePath) {
      span.attributes["agent_lens.claude_code.file_path"] = filePath;
      span.name = `${mapping.spanName}: ${abbreviatePath(filePath)}`;
    }

    // Extract command for Bash tool
    const command = extractBashCommand(request);
    if (command) {
      span.attributes["agent_lens.claude_code.command"] = command;
      span.name = `Bash: ${abbreviateCommand(command)}`;
    }

    // Extract search pattern for Grep/Glob
    const searchPattern = extractSearchPattern(request);
    if (searchPattern) {
      span.attributes["agent_lens.claude_code.search_pattern"] = searchPattern;
      span.name = `${mapping.spanName}: ${searchPattern}`;
    }

    return span;
  }

  /**
   * Process an MCP response and enrich the corresponding span
   * with result data, token usage, and cost information.
   */
  processResponse(span: AgentSpan, response: McpResponse): AgentSpan {
    let completed = completeSpanWithResponse(span, response);

    // Extract token usage if present in the response
    const usage = extractTokenUsage(response);
    if (usage) {
      completed.attributes[GenAIAttributes.USAGE_INPUT_TOKENS] = usage.inputTokens;
      completed.attributes[GenAIAttributes.USAGE_OUTPUT_TOKENS] = usage.outputTokens;
      completed.attributes[GenAIAttributes.USAGE_TOTAL_TOKENS] =
        usage.inputTokens + usage.outputTokens;

      // Calculate cost
      if (this.costTracker) {
        const cost = this.costTracker(usage.inputTokens, usage.outputTokens);
        completed.attributes[AgentLensAttributes.COST_INPUT_USD] = cost.inputUsd;
        completed.attributes[AgentLensAttributes.COST_OUTPUT_USD] = cost.outputUsd;
        completed.attributes[AgentLensAttributes.COST_TOTAL_USD] = cost.totalUsd;
      } else {
        // Fall back to otel-config enrichment
        completed = enrichSpanWithCost(completed);
      }
    }

    return completed;
  }

  /**
   * Detect thinking blocks in Claude Code's response content
   * and create thinking spans for each one.
   */
  extractThinkingSpans(
    traceId: string,
    parentSpanId: string | undefined,
    responseContent: unknown,
    branchId?: string,
  ): AgentSpan[] {
    const spans: AgentSpan[] = [];

    if (!Array.isArray(responseContent)) {
      return spans;
    }

    for (const block of responseContent) {
      if (
        block != null &&
        typeof block === "object" &&
        "type" in block &&
        (block as Record<string, unknown>).type === "thinking"
      ) {
        const thinkingText = (block as Record<string, unknown>).thinking as string;
        if (thinkingText) {
          const thinkingSpan = createThinkingSpan(traceId, parentSpanId, thinkingText, branchId);
          thinkingSpan.attributes["gen_ai.system"] = "claude-code";
          thinkingSpan.endTime = Date.now();
          thinkingSpan.status = "ok";
          spans.push(thinkingSpan);
        }
      }
    }

    return spans;
  }

  /**
   * Get the detected session info, if Claude Code has been identified.
   */
  getSessionInfo(): ClaudeCodeSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Check if the adapter has detected Claude Code as the client.
   */
  isClaudeCode(): boolean {
    return this.sessionInfo?.isClaudeCode ?? false;
  }

  /**
   * Get the risk level for a given tool call, considering
   * Claude Code's permission settings.
   */
  getToolRiskLevel(
    toolName: string,
    permission?: ClaudeCodePermission,
  ): "low" | "medium" | "high" | "critical" {
    if (permission) {
      return mapPermissionToApprovalGate(toolName, permission).riskLevel;
    }
    return getRiskLevel(toolName);
  }

  /**
   * Determine whether a tool call should be gated for approval.
   */
  shouldGateToolCall(
    toolName: string,
    permission?: ClaudeCodePermission,
  ): boolean {
    if (permission) {
      return mapPermissionToApprovalGate(toolName, permission).shouldGate;
    }
    // Default: gate high-risk and critical tools
    const risk = getRiskLevel(toolName);
    return risk === "high" || risk === "critical";
  }
}

// ─── Helper Functions ───

/**
 * Extracts a file path from Claude Code tool arguments.
 */
function extractFilePath(request: McpRequest): string | undefined {
  const params = request.params as Record<string, unknown> | undefined;
  if (!params) return undefined;

  const args = params.arguments as Record<string, unknown> | undefined;
  if (!args) return undefined;

  // Read, Write, Edit use "file_path"; Glob uses "path"
  return (args.file_path as string) ?? (args.path as string) ?? undefined;
}

/**
 * Extracts the command from a Bash tool call.
 */
function extractBashCommand(request: McpRequest): string | undefined {
  const params = request.params as Record<string, unknown> | undefined;
  if (!params || params.name !== "Bash") return undefined;

  const args = params.arguments as Record<string, unknown> | undefined;
  return args?.command as string | undefined;
}

/**
 * Extracts a search pattern from Grep or Glob tool calls.
 */
function extractSearchPattern(request: McpRequest): string | undefined {
  const params = request.params as Record<string, unknown> | undefined;
  if (!params) return undefined;

  const toolName = params.name as string;
  if (toolName !== "Grep" && toolName !== "Glob") return undefined;

  const args = params.arguments as Record<string, unknown> | undefined;
  return (args?.pattern as string) ?? undefined;
}

/**
 * Extracts token usage information from Claude Code API responses.
 * Claude Code embeds usage data in its response metadata.
 */
function extractTokenUsage(
  response: McpResponse,
): { inputTokens: number; outputTokens: number } | null {
  const result = response.result as Record<string, unknown> | undefined;
  if (!result) return null;

  // Check for usage in the result directly
  const usage = result.usage as Record<string, unknown> | undefined;
  if (usage) {
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens };
    }
  }

  // Check nested in metadata
  const meta = result._meta as Record<string, unknown> | undefined;
  if (meta?.usage) {
    const metaUsage = meta.usage as Record<string, unknown>;
    const inputTokens = typeof metaUsage.input_tokens === "number" ? metaUsage.input_tokens : 0;
    const outputTokens = typeof metaUsage.output_tokens === "number" ? metaUsage.output_tokens : 0;
    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens };
    }
  }

  return null;
}

/**
 * Abbreviates a file path for display in span names.
 * E.g., "/home/user/project/src/deep/file.ts" → "src/deep/file.ts"
 */
function abbreviatePath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= 3) return filePath;
  return parts.slice(-3).join("/");
}

/**
 * Abbreviates a bash command for display in span names.
 * Truncates long commands to a reasonable length.
 */
function abbreviateCommand(command: string): string {
  const firstLine = command.split("\n")[0]!;
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57) + "...";
}
