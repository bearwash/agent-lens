// ─── Agent Lens OpenClaw Gateway Plugin ───
// Hooks into OpenClaw v2026.3.7's `kind: "context-engine"` plugin system
// to stream agent telemetry to the Agent Lens proxy.

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { AgentSession, DashboardEvent } from "@agent-lens/protocol";
import { createTraceId } from "@agent-lens/otel-config";
import { mapEventToSpan } from "./event-mapper.js";
import type {
  OpenClawPlugin,
  OpenClawPluginConfig,
  OpenClawEvent,
  OpenClawContext,
} from "./types.js";

export type {
  OpenClawPlugin,
  OpenClawPluginConfig,
  OpenClawEvent,
  OpenClawContext,
} from "./types.js";
export { mapEventToSpan } from "./event-mapper.js";

// ─── Default Configuration ───

const DEFAULT_PROXY_URL = "ws://localhost:18790";
const DEFAULT_AGENT_SYSTEM = "openclaw";
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_RECONNECT_BASE_DELAY = 1000;

// ─── Plugin Factory ───

/**
 * Creates an Agent Lens plugin for the OpenClaw gateway.
 *
 * Usage in openclaw.config.yaml:
 * ```yaml
 * plugins:
 *   - kind: context-engine
 *     module: "@agent-lens/openclaw-plugin"
 *     config:
 *       proxyUrl: ws://localhost:18790
 * ```
 */
export function createPlugin(): OpenClawPlugin {
  let ws: WebSocket | null = null;
  let config: Required<OpenClawPluginConfig>;
  let traceId: string;
  let sessionId: string;
  let branchId: string;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isShuttingDown = false;

  // ─── WebSocket Management ───

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isShuttingDown) {
        reject(new Error("Plugin is shutting down"));
        return;
      }

      ws = new WebSocket(config.proxyUrl);

      ws.on("open", () => {
        reconnectAttempts = 0;
        resolve();
      });

      ws.on("close", () => {
        if (!isShuttingDown) {
          scheduleReconnect();
        }
      });

      ws.on("error", (err) => {
        if (reconnectAttempts === 0 && ws?.readyState !== WebSocket.OPEN) {
          reject(err);
        }
      });
    });
  }

  function scheduleReconnect(): void {
    if (isShuttingDown) return;
    if (reconnectAttempts >= config.maxReconnectAttempts) {
      console.error(
        `[agent-lens] Max reconnection attempts (${config.maxReconnectAttempts}) reached. Giving up.`,
      );
      return;
    }

    const delay = config.reconnectBaseDelay * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    console.warn(
      `[agent-lens] WebSocket disconnected. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${config.maxReconnectAttempts})...`,
    );

    reconnectTimer = setTimeout(() => {
      connect().catch((err) => {
        console.error(`[agent-lens] Reconnection failed:`, err.message);
      });
    }, delay);
  }

  function send(event: DashboardEvent): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  // ─── Plugin Implementation ───

  const plugin: OpenClawPlugin = {
    kind: "context-engine",
    name: "agent-lens",

    async bootstrap(pluginConfig: OpenClawPluginConfig): Promise<void> {
      config = {
        proxyUrl: pluginConfig.proxyUrl ?? DEFAULT_PROXY_URL,
        agentSystem: pluginConfig.agentSystem ?? DEFAULT_AGENT_SYSTEM,
        model: pluginConfig.model ?? "unknown",
        maxReconnectAttempts:
          pluginConfig.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
        reconnectBaseDelay:
          pluginConfig.reconnectBaseDelay ?? DEFAULT_RECONNECT_BASE_DELAY,
      };

      traceId = createTraceId();
      sessionId = randomUUID();
      branchId = randomUUID();

      await connect();

      // Send session start event to the proxy
      const session: AgentSession = {
        sessionId,
        agentSystem: config.agentSystem,
        startedAt: Date.now(),
        status: "running",
        rootBranchId: branchId,
        activeBranchId: branchId,
        metadata: {
          model: config.model,
          pluginVersion: "0.1.0",
        },
      };

      send({ type: "session:start", session });
    },

    async ingest(event: OpenClawEvent): Promise<void> {
      const span = mapEventToSpan(event, traceId, branchId);
      send({ type: "span:start", span });

      // If the span is already complete (has endTime), send the end event too
      if (span.endTime != null) {
        send({
          type: "span:end",
          spanId: span.spanId,
          endTime: span.endTime,
          status: span.status,
        });
      }
    },

    async assemble(context: OpenClawContext): Promise<OpenClawContext> {
      // Inject approval gate status into context metadata so downstream
      // plugins and the LLM can see if operations are pending approval.
      context.metadata["agent_lens.session_id"] = sessionId;
      context.metadata["agent_lens.trace_id"] = traceId;
      context.metadata["agent_lens.branch_id"] = branchId;

      // If there is an active approval gate, inject a system fragment
      // informing the LLM that a tool call is awaiting human approval.
      if (context.metadata["agent_lens.approval_pending"] === true) {
        const pendingTool = context.metadata["agent_lens.approval_pending_tool"] as
          | string
          | undefined;

        context.systemFragments.push(
          `[Agent Lens] A tool call${pendingTool ? ` (${pendingTool})` : ""} is awaiting human approval. ` +
            `Do not retry or re-invoke this tool until approval is granted or denied.`,
        );
      }

      // Inject branch context if we are on a non-root branch
      const parentBranchId = context.metadata["agent_lens.parent_branch_id"] as
        | string
        | undefined;
      if (parentBranchId) {
        const branchLabel = context.metadata["agent_lens.branch_label"] as
          | string
          | undefined;

        context.systemFragments.push(
          `[Agent Lens] You are on branch "${branchLabel ?? branchId}" ` +
            `(forked from ${parentBranchId}). Stay focused on this branch's objective.`,
        );
      }

      return context;
    },
  };

  return plugin;
}
