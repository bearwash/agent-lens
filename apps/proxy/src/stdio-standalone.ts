// ─── Standalone Stdio Proxy ───
// Wraps an MCP server and sends observation spans to a running Agent Lens proxy.
// Usage: echo '...' | node dist/stdio-standalone.js <command> [args...]
// The proxy (pnpm dev) must be running separately.

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { McpRequest, McpResponse, McpMessage, AgentSpan } from "@agent-lens/protocol";
import {
  createToolCallSpan,
  completeSpanWithResponse,
  createTraceId,
} from "@agent-lens/otel-config";

const LENS_URL = process.env.LENS_URL ?? "http://localhost:18790";

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("Usage: node stdio-standalone.js <mcp-server-command> [args...]");
  console.error("Example: echo '{...}' | node stdio-standalone.js npx @modelcontextprotocol/server-filesystem /tmp");
  process.exit(1);
}

const traceId = createTraceId();
const sessionId = randomUUID();
let buffer = "";
const pendingSpans = new Map<string | number, AgentSpan>();

async function sendToLens(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${LENS_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Lens not running — silently continue, still proxy the traffic
  }
}

// Register session
sendToLens("/api/ingest/session", {
  sessionId,
  agentSystem: "stdio-proxy",
  startedAt: Date.now(),
  status: "running",
  rootBranchId: "main",
  activeBranchId: "main",
  metadata: { traceId, command, args },
});

// Spawn MCP server
const child: ChildProcess = spawn(command, args, {
  stdio: ["pipe", "pipe", "inherit"],
  shell: true,
});

function parseMessages(data: string): McpMessage[] {
  buffer += data;
  const messages: McpMessage[] = [];
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed));
    } catch { /* not JSON — pass through */ }
  }
  return messages;
}

// Agent → Proxy → MCP Server
process.stdin.on("data", (chunk) => {
  const data = chunk.toString();
  const messages = parseMessages(data);

  for (const msg of messages) {
    if ("method" in msg && "id" in msg) {
      const request = msg as McpRequest;
      const span = createToolCallSpan(traceId, undefined, `stdio:${command}`, request, "main");
      pendingSpans.set(request.id, span);
      sendToLens("/api/ingest/span", span);
    }
    child.stdin!.write(JSON.stringify(msg) + "\n");
  }
});

// MCP Server → Proxy → Agent
let serverBuffer = "";
child.stdout!.on("data", (chunk) => {
  serverBuffer += chunk.toString();
  const lines = serverBuffer.split("\n");
  serverBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const msg = JSON.parse(trimmed) as McpMessage;

      if ("id" in msg && ("result" in msg || "error" in msg)) {
        const response = msg as McpResponse;
        const span = pendingSpans.get(response.id);
        if (span) {
          const completed = completeSpanWithResponse(span, response);
          sendToLens("/api/ingest/span", completed);
          pendingSpans.delete(response.id);
        }
      }
    } catch { /* not JSON */ }

    process.stdout.write(trimmed + "\n");
  }
});

process.stdin.on("end", () => child.kill());
child.on("exit", () => process.exit(0));
