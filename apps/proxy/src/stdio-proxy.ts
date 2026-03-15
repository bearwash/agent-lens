// ─── Stdio MCP Proxy ───
// Sits between an agent and an MCP server process, intercepting
// JSON-RPC messages over stdin/stdout for observation and approval gating.

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { McpRequest, McpResponse, McpMessage } from "@agent-lens/protocol";
import type { Store } from "@agent-lens/store";
import {
  createToolCallSpan,
  completeSpanWithResponse,
  createTraceId,
} from "@agent-lens/otel-config";
import type { EventBus } from "./event-bus.js";
import type { ApprovalGate } from "./approval-gate.js";

export class McpStdioProxy {
  private child: ChildProcess | null = null;
  private traceId: string;
  private sessionId: string;
  private buffer = "";
  private pendingSpans = new Map<string | number, string>(); // request id → span id

  constructor(
    private command: string,
    private args: string[],
    private store: Store,
    private eventBus: EventBus,
    private approvalGate: ApprovalGate,
  ) {
    this.traceId = createTraceId();
    this.sessionId = randomUUID();
  }

  async start(): Promise<void> {
    // Create session
    await this.store.createSession({
      sessionId: this.sessionId,
      agentSystem: "stdio",
      startedAt: Date.now(),
      status: "running",
      rootBranchId: "main",
      activeBranchId: "main",
      metadata: { command: this.command, args: this.args },
    });

    this.eventBus.emit({
      type: "session:start",
      session: await this.store.getSession(this.sessionId) as any,
    });

    // Spawn target MCP server
    this.child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Agent → Proxy → MCP Server
    process.stdin.on("data", (chunk) => this.handleAgentInput(chunk));
    process.stdin.on("end", () => this.shutdown());

    // MCP Server → Proxy → Agent
    this.child.stdout!.on("data", (chunk) => this.handleServerOutput(chunk));
    this.child.on("exit", (code) => {
      this.store.updateSession(this.sessionId, {
        status: code === 0 ? "completed" : "error",
      });
    });
  }

  private async handleAgentInput(chunk: Buffer | string): Promise<void> {
    const data = chunk.toString();

    // Try to parse as JSON-RPC
    const messages = this.parseJsonRpcMessages(data);

    for (const msg of messages) {
      if ("method" in msg && "id" in msg) {
        // It's a request — intercept for observation
        const request = msg as McpRequest;
        const span = createToolCallSpan(
          this.traceId,
          undefined,
          `stdio:${this.command}`,
          request,
          "main",
        );

        await this.store.appendSpan(span);
        this.eventBus.emit({ type: "span:start", span });
        this.pendingSpans.set(request.id, span.spanId);

        // Check approval gate
        const decision = await this.approvalGate.checkAndWait(
          this.sessionId,
          span.spanId,
          `stdio:${this.command}`,
          request,
        );

        if (decision) {
          if (decision.decision === "rejected") {
            // Send error response back to agent
            const errorResponse: McpResponse = {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32000,
                message: `Rejected by operator: ${decision.operatorNote ?? "No reason given"}`,
              },
            };
            process.stdout.write(JSON.stringify(errorResponse) + "\n");
            continue;
          }

          if (decision.decision === "modified" && decision.modifiedArguments) {
            // Replace arguments with operator's modifications
            request.params = decision.modifiedArguments;
          }
        }
      }

      // Forward to MCP server
      this.child!.stdin!.write(JSON.stringify(msg) + "\n");
    }
  }

  private async handleServerOutput(chunk: Buffer | string): Promise<void> {
    const data = chunk.toString();
    const messages = this.parseJsonRpcMessages(data);

    for (const msg of messages) {
      if ("id" in msg && ("result" in msg || "error" in msg)) {
        const response = msg as McpResponse;
        const spanId = this.pendingSpans.get(response.id);

        if (spanId) {
          const span = await this.store.getSpan(spanId);
          if (span) {
            const completed = completeSpanWithResponse(span, response);
            await this.store.updateSpan(spanId, completed);
            this.eventBus.emit({
              type: "span:end",
              spanId,
              endTime: completed.endTime!,
              status: completed.status,
            });
          }
          this.pendingSpans.delete(response.id);
        }
      }

      // Forward to agent
      process.stdout.write(JSON.stringify(msg) + "\n");
    }
  }

  private parseJsonRpcMessages(data: string): McpMessage[] {
    this.buffer += data;
    const messages: McpMessage[] = [];

    // Split by newlines (JSON-RPC over stdio uses newline-delimited JSON)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        messages.push(JSON.parse(trimmed));
      } catch {
        // Not valid JSON — pass through raw
        console.error("[StdioProxy] Failed to parse JSON-RPC:", trimmed.slice(0, 100));
      }
    }

    return messages;
  }

  private shutdown(): void {
    this.child?.kill();
    this.store.updateSession(this.sessionId, { status: "completed" });
  }
}
