// ─── Agent Lens Demo Runner ───
// Starts the proxy server and runs the demo scenario.
// Usage: npx tsx src/demo-runner.ts

import { EventBus } from "./event-bus.js";
import { DashboardServer } from "./dashboard-server.js";
import { ApprovalGate } from "./approval-gate.js";
import { MemoryStore } from "@agent-lens/store";
import { runDemoScenario } from "./demo.js";

const DASHBOARD_PORT = parseInt(process.env.LENS_DASHBOARD_PORT ?? "18790");

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         Agent Lens — Demo Mode               ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  // ─── 1. Start the proxy server ───
  const store = new MemoryStore();
  const eventBus = new EventBus();
  const approvalGate = new ApprovalGate(store, eventBus);
  const dashboardServer = new DashboardServer(DASHBOARD_PORT, store, eventBus, approvalGate);

  await dashboardServer.start();
  console.log(`[Demo] Dashboard server running at ws://localhost:${DASHBOARD_PORT}`);
  console.log(`[Demo] Open the dashboard UI, then press ENTER to start the demo...`);
  console.log();

  // ─── 2. Wait for user to open dashboard ───
  await waitForEnter();

  console.log("[Demo] Starting in 2 seconds...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ─── 3. Run the demo scenario ───
  // Events are emitted directly through the EventBus, which the
  // DashboardServer subscribes to and broadcasts to all connected WS clients.
  await runDemoScenario((event) => {
    eventBus.emit(event);

    // Also persist to store for REST API endpoints
    if (event.type === "session:start") {
      store.createSession(event.session).catch(() => {});
    } else if (event.type === "span:start") {
      store.appendSpan(event.span).catch(() => {});
    } else if (event.type === "span:end") {
      store.updateSpan(event.spanId, { endTime: event.endTime, status: event.status }).catch(() => {});
    } else if (event.type === "span:update") {
      store.updateSpan(event.spanId, event.updates).catch(() => {});
    } else if (event.type === "session:update") {
      store.updateSession(event.sessionId, event.updates).catch(() => {});
    } else if (event.type === "branch:create") {
      store.createBranch(event.branch).catch(() => {});
    }
  });

  console.log();
  console.log("[Demo] Done! The dashboard should now show the full agent session.");
  console.log("[Demo] Server will remain running. Press Ctrl+C to exit.");
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive mode: just wait 2 seconds
      setTimeout(resolve, 2000);
      return;
    }
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });
}

main().catch((err) => {
  console.error("[Demo] Fatal error:", err);
  process.exit(1);
});
