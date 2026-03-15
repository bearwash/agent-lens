// ─── OpenClaw v2026.3.7 Plugin Type Definitions ───

// ─── Plugin Configuration ───

export interface OpenClawPluginConfig {
  /** WebSocket URL for the Agent Lens proxy. Default: ws://localhost:18790 */
  proxyUrl?: string;
  /** Agent system identifier reported in spans. Default: "openclaw" */
  agentSystem?: string;
  /** Model name to attach to spans. */
  model?: string;
  /** Maximum reconnection attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number;
  /** Base delay in ms between reconnection attempts (exponential backoff). Default: 1000 */
  reconnectBaseDelay?: number;
}

// ─── Gateway Event Types ───

export type OpenClawEventType = "tool_call" | "thinking" | "error" | "completion";

export interface OpenClawEventBase {
  /** Unique event ID assigned by OpenClaw gateway. */
  id: string;
  /** Timestamp of the event in Unix ms. */
  timestamp: number;
  /** Optional parent event ID for nesting. */
  parentId?: string;
}

export interface OpenClawToolCallEvent extends OpenClawEventBase {
  type: "tool_call";
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface OpenClawThinkingEvent extends OpenClawEventBase {
  type: "thinking";
  content: string;
}

export interface OpenClawErrorEvent extends OpenClawEventBase {
  type: "error";
  errorCode: string;
  message: string;
  details?: unknown;
}

export interface OpenClawCompletionEvent extends OpenClawEventBase {
  type: "completion";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason: string;
}

export type OpenClawEvent =
  | OpenClawToolCallEvent
  | OpenClawThinkingEvent
  | OpenClawErrorEvent
  | OpenClawCompletionEvent;

// ─── Context Assembly ───

export interface OpenClawContext {
  /** The messages array being sent to the LLM. */
  messages: Array<{ role: string; content: string }>;
  /** System prompt fragments that will be concatenated. */
  systemFragments: string[];
  /** Metadata passed through the pipeline. */
  metadata: Record<string, unknown>;
}

// ─── Plugin Interface (context-engine kind) ───

export interface OpenClawPlugin {
  kind: "context-engine";
  name: string;

  /** Called once when the gateway loads the plugin. */
  bootstrap(config: OpenClawPluginConfig): Promise<void>;

  /** Called for every gateway event (tool calls, thinking, errors, completions). */
  ingest(event: OpenClawEvent): Promise<void>;

  /** Called before sending context to the LLM; can mutate the context. */
  assemble(context: OpenClawContext): Promise<OpenClawContext>;
}
