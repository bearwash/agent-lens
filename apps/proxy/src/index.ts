// ─── Agent Lens Proxy ───
// MCP observation proxy that intercepts agent↔tool communication,
// records OTel-compliant spans, and streams events to the dashboard.

import { McpStdioProxy } from "./stdio-proxy.js";
import { StreamableHttpProxy } from "./http-proxy.js";
import { EventBus } from "./event-bus.js";
import { ApprovalGate } from "./approval-gate.js";
import { DashboardServer } from "./dashboard-server.js";
import { MemoryStore, PgStore } from "@agent-lens/store";
import type { Store } from "@agent-lens/store";

const DEFAULT_DASHBOARD_PORT = 18790;
const DEFAULT_HTTP_PROXY_PORT = 18791;

async function createStore(): Promise<Store> {
  const storeType = process.env.LENS_STORE ?? "memory";
  const dbUrl = process.env.DATABASE_URL;

  if (storeType === "pg" && dbUrl) {
    console.log("[Store] Using PostgreSQL...");
    // PgStore with autoMigrate: true handles migrations internally
    return new PgStore({ connectionString: dbUrl, autoMigrate: true });
  }

  console.log("[Store] Using in-memory store");
  return new MemoryStore();
}

async function main() {
  const dashboardPort = parseInt(process.env.LENS_DASHBOARD_PORT ?? String(DEFAULT_DASHBOARD_PORT));
  const httpProxyPort = parseInt(process.env.LENS_HTTP_PROXY_PORT ?? String(DEFAULT_HTTP_PROXY_PORT));

  const store = await createStore();
  const eventBus = new EventBus();
  const approvalGate = new ApprovalGate(store, eventBus);

  // WebSocket server for dashboard real-time events
  const dashboardServer = new DashboardServer(dashboardPort, store, eventBus, approvalGate);
  await dashboardServer.start();

  // Streamable HTTP proxy
  const httpProxy = new StreamableHttpProxy(httpProxyPort, store, eventBus, approvalGate);
  await httpProxy.start();

  console.log(`
  ╔══════════════════════════════════════════════╗
  ║           🔍 Agent Lens v0.1.0              ║
  ║                                              ║
  ║  Dashboard WS:  ws://localhost:${dashboardPort}        ║
  ║  HTTP Proxy:    http://localhost:${httpProxyPort}       ║
  ║                                              ║
  ║  Stdio mode:    pipe through agent-lens      ║
  ╚══════════════════════════════════════════════╝
  `);

  // Handle stdio proxy mode when piped
  if (!process.stdin.isTTY) {
    const targetCommand = process.argv[2];
    const targetArgs = process.argv.slice(3);

    if (targetCommand) {
      const stdioProxy = new McpStdioProxy(targetCommand, targetArgs, store, eventBus, approvalGate);
      await stdioProxy.start();
    }
  }
}

main().catch((err) => {
  console.error("Agent Lens failed to start:", err);
  process.exit(1);
});
