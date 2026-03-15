// ─── Agent Lens Protocol Types ───
// Shared type definitions for MCP proxy, OTel spans, and dashboard communication.

// ─── MCP Message Types (2026-03-26 spec) ───

export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: McpError;
}

export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

export interface McpNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export type McpMessage = McpRequest | McpResponse | McpNotification;

// ─── Agent Span (OTel GenAI Semantic Conventions) ───

export interface AgentSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;    // Unix ms
  endTime?: number;      // Unix ms, undefined if still running
  status: SpanStatus;
  attributes: SpanAttributes;
  events: SpanEvent[];
}

export type SpanKind =
  | "thinking"         // LLM reasoning step
  | "tool_call"        // MCP tool invocation
  | "tool_result"      // MCP tool response
  | "retry"            // Automatic retry
  | "user_intervention" // Human override / approval
  | "branch";          // Forked reasoning path

export type SpanStatus = "ok" | "error" | "pending" | "paused";

export interface SpanAttributes {
  // ─── OTel GenAI Semantic Conventions 1.37+ (Full Compliance) ───
  "gen_ai.system"?: string;                    // e.g. "openclaw", "claude", "openai"
  "gen_ai.request.model"?: string;             // Model ID e.g. "claude-opus-4-6"
  "gen_ai.request.max_tokens"?: number;
  "gen_ai.request.temperature"?: number;
  "gen_ai.request.top_p"?: number;
  "gen_ai.request.stop_sequences"?: string;    // JSON array
  "gen_ai.response.id"?: string;               // Provider response ID
  "gen_ai.response.model"?: string;            // Actual model used (may differ from request)
  "gen_ai.response.finish_reason"?: string;    // "stop" | "length" | "tool_use" | "content_filter"
  "gen_ai.task"?: string;                      // High-level task description
  "gen_ai.action"?: string;                    // Tool name / action taken
  "gen_ai.choice.index"?: number;
  "gen_ai.usage.input_tokens"?: number;
  "gen_ai.usage.output_tokens"?: number;
  "gen_ai.usage.total_tokens"?: number;
  "gen_ai.prompt"?: string;                    // System/user prompt (if capture enabled)
  "gen_ai.completion"?: string;                // Model completion text

  // ─── Agent Lens: MCP & Reasoning ───
  "agent_lens.mcp.server"?: string;
  "agent_lens.mcp.tool"?: string;
  "agent_lens.mcp.arguments"?: string;         // JSON-serialized
  "agent_lens.reasoning"?: string;             // Chain-of-thought text
  "agent_lens.branch_id"?: string;
  "agent_lens.parent_branch_id"?: string;
  "agent_lens.approval_required"?: boolean;
  "agent_lens.approval_status"?: "pending" | "approved" | "rejected" | "modified";

  // ─── Agent Lens: Multimodal Attachments ───
  "agent_lens.attachments"?: string;           // JSON-serialized Attachment[]

  // ─── Agent Lens: Inference Economics ───
  "agent_lens.cost.input_usd"?: number;        // Cost of input tokens in USD
  "agent_lens.cost.output_usd"?: number;       // Cost of output tokens in USD
  "agent_lens.cost.total_usd"?: number;        // Total cost for this span

  [key: string]: unknown;
}

// ─── Multimodal Attachment ───

export interface Attachment {
  id: string;
  type: "image" | "video" | "audio" | "screenshot" | "sensor_data" | "document";
  mimeType: string;                            // e.g. "image/png", "video/mp4"
  label?: string;                              // Human-readable label
  /** Base64-encoded data for small attachments (<1MB) */
  dataBase64?: string;
  /** URL for large or externally hosted attachments */
  url?: string;
  /** Thumbnail as base64 data URI for timeline preview */
  thumbnailBase64?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;          // Device info, coordinates, etc.
}

// ─── Inference Cost Model ───

export interface ModelPricing {
  model: string;                               // Model ID pattern e.g. "claude-opus-4-6"
  inputPricePerMToken: number;                 // USD per 1M input tokens
  outputPricePerMToken: number;                // USD per 1M output tokens
}

export const DEFAULT_PRICING: ModelPricing[] = [
  { model: "claude-opus-4-6",       inputPricePerMToken: 15,  outputPricePerMToken: 75 },
  { model: "claude-sonnet-4-6",     inputPricePerMToken: 3,   outputPricePerMToken: 15 },
  { model: "claude-haiku-4-5",      inputPricePerMToken: 0.8, outputPricePerMToken: 4 },
  { model: "gpt-4o",                inputPricePerMToken: 2.5, outputPricePerMToken: 10 },
  { model: "gpt-4.1",              inputPricePerMToken: 2,   outputPricePerMToken: 8 },
  { model: "gemini-3-pro",          inputPricePerMToken: 1.25, outputPricePerMToken: 5 },
  { model: "gemini-3-flash",        inputPricePerMToken: 0.15, outputPricePerMToken: 0.6 },
];

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

// ─── Session & Branch Management ───

export interface AgentSession {
  sessionId: string;
  agentSystem: string;       // "openclaw" | "claude-code" | etc.
  startedAt: number;
  status: "running" | "paused" | "completed" | "error";
  rootBranchId: string;
  activeBranchId: string;
  metadata?: Record<string, unknown>;
}

export interface Branch {
  branchId: string;
  parentBranchId?: string;
  forkPointSpanId?: string;  // The span where this branch diverged
  createdAt: number;
  label?: string;            // Human-readable label e.g. "Fix: use correct API key"
  status: "active" | "abandoned" | "merged";
}

// ─── Approval Gate ───

export interface ApprovalRequest {
  requestId: string;
  sessionId: string;
  spanId: string;
  mcpServer: string;
  toolName: string;
  arguments: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical";
  reason: string;            // Why this was flagged
  createdAt: number;
}

export interface ApprovalDecision {
  requestId: string;
  decision: "approved" | "rejected" | "modified";
  modifiedArguments?: Record<string, unknown>;
  operatorNote?: string;
  decidedAt: number;
  decidedBy: string;         // Operator identifier
}

// ─── Dashboard WebSocket Events ───

export type DashboardEvent =
  | { type: "span:start"; span: AgentSpan }
  | { type: "span:update"; spanId: string; updates: Partial<AgentSpan> }
  | { type: "span:end"; spanId: string; endTime: number; status: SpanStatus }
  | { type: "session:start"; session: AgentSession }
  | { type: "session:update"; sessionId: string; updates: Partial<AgentSession> }
  | { type: "branch:create"; branch: Branch }
  | { type: "branch:update"; branchId: string; updates: Partial<Branch> }
  | { type: "approval:request"; approval: ApprovalRequest }
  | { type: "approval:decision"; decision: ApprovalDecision };

// ─── Approval Rule Configuration ───

export interface ApprovalRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: ApprovalCondition[];
  riskLevel: ApprovalRequest["riskLevel"];
}

export type ApprovalCondition =
  | { type: "tool_name"; pattern: string }      // glob pattern e.g. "shell_*"
  | { type: "server_name"; pattern: string }
  | { type: "argument_match"; key: string; pattern: string }
  | { type: "keyword"; pattern: string };        // matches reasoning text
