// ─── Streamable HTTP MCP Proxy ───
// Transparent proxy for MCP Streamable HTTP transport (2026-03-26 spec).
// Intercepts POST requests to the MCP endpoint, records spans, and applies approval gates.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { McpRequest, McpResponse } from "@agent-lens/protocol";
import type { Store } from "@agent-lens/store";
import {
  createToolCallSpan,
  completeSpanWithResponse,
  createTraceId,
} from "@agent-lens/otel-config";
import type { EventBus } from "./event-bus.js";
import type { ApprovalGate } from "./approval-gate.js";

export class StreamableHttpProxy {
  private traceId: string;
  private sessionId: string;

  constructor(
    private port: number,
    private store: Store,
    private eventBus: EventBus,
    private approvalGate: ApprovalGate,
  ) {
    this.traceId = createTraceId();
    this.sessionId = randomUUID();
  }

  async start(): Promise<void> {
    await this.store.createSession({
      sessionId: this.sessionId,
      agentSystem: "streamable-http",
      startedAt: Date.now(),
      status: "running",
      rootBranchId: "main",
      activeBranchId: "main",
    });

    const server = createServer((req, res) => this.handleRequest(req, res));

    return new Promise((resolve) => {
      server.listen(this.port, () => {
        console.log(`[HTTP Proxy] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers for dashboard
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessionId: this.sessionId }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    try {
      const body = await this.readBody(req);
      const message = JSON.parse(body) as McpRequest;
      const targetUrl = req.headers["x-mcp-target"] as string | undefined;

      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32600, message: "Missing X-MCP-Target header" },
        }));
        return;
      }

      // Create observation span
      const span = createToolCallSpan(
        this.traceId,
        undefined,
        targetUrl,
        message,
        "main",
      );
      await this.store.appendSpan(span);
      this.eventBus.emit({ type: "span:start", span });

      // Approval gate check
      if ("id" in message && "method" in message) {
        const decision = await this.approvalGate.checkAndWait(
          this.sessionId,
          span.spanId,
          targetUrl,
          message,
        );

        if (decision?.decision === "rejected") {
          const errorResp: McpResponse = {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32000,
              message: `Rejected by operator: ${decision.operatorNote ?? ""}`,
            },
          };
          this.eventBus.emit({
            type: "span:end",
            spanId: span.spanId,
            endTime: Date.now(),
            status: "error",
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(errorResp));
          return;
        }

        if (decision?.decision === "modified" && decision.modifiedArguments) {
          message.params = decision.modifiedArguments;
        }
      }

      // Forward to target MCP server
      const targetResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
        body: JSON.stringify(message),
      });

      const responseBody = await targetResponse.text();

      // Record response span
      try {
        const mcpResponse = JSON.parse(responseBody) as McpResponse;
        const completed = completeSpanWithResponse(span, mcpResponse);
        await this.store.updateSpan(span.spanId, completed);
        this.eventBus.emit({
          type: "span:end",
          spanId: span.spanId,
          endTime: completed.endTime!,
          status: completed.status,
        });
      } catch {
        // Non-JSON response — still complete the span
        await this.store.updateSpan(span.spanId, { endTime: Date.now(), status: "ok" });
      }

      // Stream response back with original headers
      res.writeHead(targetResponse.status, {
        "Content-Type": targetResponse.headers.get("Content-Type") ?? "application/json",
      });
      res.end(responseBody);
    } catch (err) {
      // Complete the span as error if it was created
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[HTTP Proxy] Error:", errMsg);

      // Try to find and complete the pending span
      try {
        const sessions = await this.store.listSessions();
        // Mark any pending spans as error
        for (const session of sessions) {
          const spans = await this.store.getSpansByTrace(this.traceId);
          for (const span of spans) {
            if (span.status === "pending") {
              await this.store.updateSpan(span.spanId, { endTime: Date.now(), status: "error" });
              this.eventBus.emit({ type: "span:end", spanId: span.spanId, endTime: Date.now(), status: "error" });
            }
          }
        }
      } catch { /* best effort */ }

      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Proxy error: ${errMsg}` }));
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }
}
