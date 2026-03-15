// ─── Dashboard WebSocket Server ───
// Streams real-time events to the Next.js dashboard and handles
// approval decisions from operators.

import { WebSocketServer, type WebSocket } from "ws";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { DashboardEvent, ApprovalDecision, Branch } from "@agent-lens/protocol";
import { createBranchSpan, createTraceId } from "@agent-lens/otel-config";
import type { Store } from "@agent-lens/store";
import type { EventBus } from "./event-bus.js";
import type { ApprovalGate } from "./approval-gate.js";

interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

export class DashboardServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  constructor(
    private port: number,
    private store: Store,
    private eventBus: EventBus,
    private approvalGate: ApprovalGate,
  ) {}

  async start(): Promise<void> {
    const httpServer = createServer((req, res) => {
      // REST endpoints for the dashboard

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === "/api/sessions" && req.method === "GET") {
        this.store.listSessions().then((sessions) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(sessions));
        });
        return;
      }

      if (req.url?.startsWith("/api/spans/") && req.method === "GET") {
        const traceId = req.url.split("/api/spans/")[1];
        if (traceId) {
          this.store.getSpansByTrace(traceId).then((spans) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(spans));
          });
          return;
        }
      }

      if (req.url === "/api/approvals/pending" && req.method === "GET") {
        this.store.getPendingApprovals().then((approvals) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(approvals));
        });
        return;
      }

      if (req.url === "/api/approvals/rules" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(this.approvalGate.getRules()));
        return;
      }

      // ─── Branch Management Endpoints ───

      if (req.url?.startsWith("/api/branches/") && req.method === "GET") {
        const sessionId = req.url.split("/api/branches/")[1];
        if (sessionId) {
          this.store.getBranchesBySession(sessionId).then((branches) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(branches));
          });
          return;
        }
      }

      if (req.url === "/api/branches" && req.method === "POST") {
        this.handleCreateBranch(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`[Dashboard] Client connected (${this.clients.size} total)`);

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage;
          this.handleClientMessage(ws, msg);
        } catch (err) {
          console.error("[Dashboard] Invalid message:", err);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`[Dashboard] Client disconnected (${this.clients.size} total)`);
      });
    });

    // Subscribe to all events and broadcast to connected clients
    this.eventBus.subscribe((event) => {
      this.broadcast(event);
    });

    return new Promise((resolve) => {
      httpServer.listen(this.port, () => {
        console.log(`[Dashboard] WebSocket + REST on port ${this.port}`);
        resolve();
      });
    });
  }

  private async handleCreateBranch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readBody(req);
      const { sessionId, forkPointSpanId, label } = JSON.parse(body) as {
        sessionId: string;
        forkPointSpanId: string;
        label?: string;
      };

      const session = await this.store.getSession(sessionId);
      if (!session) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      const forkSpan = await this.store.getSpan(forkPointSpanId);
      if (!forkSpan) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Fork point span not found" }));
        return;
      }

      const newBranchId = randomUUID().slice(0, 8);
      const parentBranchId = (forkSpan.attributes["agent_lens.branch_id"] as string) ?? "main";

      // Create branch record
      const branch: Branch = {
        branchId: newBranchId,
        parentBranchId,
        forkPointSpanId,
        createdAt: Date.now(),
        label,
        status: "active",
      };
      await this.store.createBranch(branch);

      // Create a branch span for visualization
      const branchSpan = createBranchSpan(
        forkSpan.traceId,
        forkPointSpanId,
        newBranchId,
        parentBranchId,
        label,
      );
      await this.store.appendSpan(branchSpan);

      // Broadcast events
      this.eventBus.emit({ type: "branch:create", branch });
      this.eventBus.emit({ type: "span:start", span: branchSpan });
      this.eventBus.emit({
        type: "span:end",
        spanId: branchSpan.spanId,
        endTime: Date.now(),
        status: "ok",
      });

      // Update session's active branch
      await this.store.updateSession(sessionId, { activeBranchId: newBranchId });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ branch, branchSpan }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }

  private handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "approval:decision": {
        const decision = msg as unknown as { type: string; decision: ApprovalDecision };
        this.approvalGate.submitDecision(decision.decision);
        break;
      }

      case "branch:create": {
        const { sessionId, forkPointSpanId, label } = msg as unknown as {
          type: string;
          sessionId: string;
          forkPointSpanId: string;
          label?: string;
        };
        // Reuse the REST handler logic via a synthetic request
        this.createBranchFromWs(sessionId, forkPointSpanId, label);
        break;
      }

      case "subscribe:session": {
        // Future: per-session subscription filtering
        break;
      }

      default:
        console.warn(`[Dashboard] Unknown message type: ${msg.type}`);
    }
  }

  private async createBranchFromWs(
    sessionId: string,
    forkPointSpanId: string,
    label?: string,
  ): Promise<void> {
    try {
      const session = await this.store.getSession(sessionId);
      const forkSpan = await this.store.getSpan(forkPointSpanId);
      if (!session || !forkSpan) return;

      const newBranchId = randomUUID().slice(0, 8);
      const parentBranchId = (forkSpan.attributes["agent_lens.branch_id"] as string) ?? "main";

      const branch: Branch = {
        branchId: newBranchId,
        parentBranchId,
        forkPointSpanId,
        createdAt: Date.now(),
        label,
        status: "active",
      };
      await this.store.createBranch(branch);

      const branchSpan = createBranchSpan(
        forkSpan.traceId,
        forkPointSpanId,
        newBranchId,
        parentBranchId,
        label,
      );
      await this.store.appendSpan(branchSpan);

      this.eventBus.emit({ type: "branch:create", branch });
      this.eventBus.emit({ type: "span:start", span: branchSpan });
      this.eventBus.emit({
        type: "span:end",
        spanId: branchSpan.spanId,
        endTime: Date.now(),
        status: "ok",
      });

      await this.store.updateSession(sessionId, { activeBranchId: newBranchId });
    } catch (err) {
      console.error("[Dashboard] Branch creation failed:", err);
    }
  }

  private broadcast(event: DashboardEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  }
}
