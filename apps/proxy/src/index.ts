// ─── Agent Lens Proxy ───
// MCP observation proxy that intercepts agent↔tool communication,
// records OTel-compliant spans, and streams events to the dashboard.

import { McpStdioProxy } from "./stdio-proxy.js";
import { StreamableHttpProxy } from "./http-proxy.js";
import { EventBus } from "./event-bus.js";
import { ApprovalGate } from "./approval-gate.js";
import { AgenticFirewall } from "./firewall.js";
import { DashboardServer } from "./dashboard-server.js";
import { MemoryStore, PgStore, AuditTrail } from "@agent-lens/store";
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
  const firewall = new AgenticFirewall(store, eventBus);

  // Phase 4: Audit Trail — cryptographically chained append-only log
  const auditTrail = new AuditTrail(store);

  // Subscribe to eventBus to automatically record audit entries
  eventBus.subscribe((event) => {
    switch (event.type) {
      case "session:start":
        auditTrail.record({ type: "session.start", session: event.session });
        break;
      case "span:start":
        auditTrail.record({ type: "span.recorded", span: event.span });
        break;
      case "span:end":
        // span:end is an update, not a new span recording — skip to avoid duplication
        break;
      case "approval:request":
        auditTrail.record({ type: "approval.requested", request: event.approval });
        break;
      case "approval:decision":
        auditTrail.record({ type: "approval.decided", decision: event.decision });
        break;
      case "branch:create":
        auditTrail.record({ type: "branch.created", branch: event.branch });
        break;
      default:
        break;
    }
  });

  // WebSocket server for dashboard real-time events
  const dashboardServer = new DashboardServer(dashboardPort, store, eventBus, approvalGate, firewall, auditTrail);
  await dashboardServer.start();

  // Streamable HTTP proxy
  const httpProxy = new StreamableHttpProxy(httpProxyPort, store, eventBus, approvalGate);
  await httpProxy.start();

  const fwConfig = firewall.getConfig();

  console.log(`
  ╔══════════════════════════════════════════════╗
  ║           🔍 Agent Lens v0.1.0              ║
  ║                                              ║
  ║  Dashboard WS:  ws://localhost:${dashboardPort}        ║
  ║  HTTP Proxy:    http://localhost:${httpProxyPort}       ║
  ║  Firewall:      ${fwConfig.enabled ? fwConfig.mode.toUpperCase().padEnd(27) : "DISABLED".padEnd(27)}║
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
