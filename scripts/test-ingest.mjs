// ─── Quick test: send sample spans to Agent Lens via REST API ───
// Usage: node scripts/test-ingest.mjs
// Requires: proxy running (pnpm dev or pnpm dev:proxy)
// No dependencies — uses native fetch

const BASE = process.env.LENS_URL ?? "http://localhost:18790";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Check proxy is running
  try {
    await fetch(`${BASE}/api/sessions`);
  } catch {
    console.error(`Cannot connect to ${BASE}`);
    console.error("Start the proxy first: pnpm dev");
    process.exit(1);
  }

  console.log(`Connected to ${BASE}\n`);

  const sessionId = `test-${Date.now()}`;
  const traceId = `trace-${Date.now()}`;
  let spanNum = 0;

  // 1. Create session
  await post("/api/ingest/session", {
    sessionId,
    agentSystem: "test-agent",
    startedAt: Date.now(),
    status: "running",
    rootBranchId: "main",
    activeBranchId: "main",
    metadata: { traceId },
  });
  console.log(`Session: ${sessionId}\n`);

  // Helper
  async function sendSpan(name, kind, durationMs, extra = {}) {
    spanNum++;
    const now = Date.now();
    await post("/api/ingest/span", {
      traceId,
      spanId: `${traceId}-${String(spanNum).padStart(3, "0")}`,
      name,
      kind,
      startTime: now,
      endTime: now + durationMs,
      status: "ok",
      attributes: {
        "gen_ai.system": "test",
        "gen_ai.request.model": "claude-opus-4-6",
        "agent_lens.branch_id": "main",
        ...extra,
      },
      events: [],
    });
    console.log(`  [${spanNum}] ${kind}: ${name}`);
  }

  // 2. Send spans with delays (so you can watch them appear)
  await sendSpan("thinking", "thinking", 1200, {
    "agent_lens.reasoning": "Let me analyze what the user is asking for. I need to read the source file first to understand the current implementation.",
  });
  await sleep(800);

  await sendSpan("read_file: src/index.ts", "tool_call", 340, {
    "agent_lens.mcp.tool": "read_file",
    "agent_lens.mcp.server": "filesystem",
    "agent_lens.mcp.arguments": JSON.stringify({ path: "src/index.ts" }),
    "gen_ai.usage.input_tokens": 1500,
    "gen_ai.usage.output_tokens": 200,
    "gen_ai.usage.total_tokens": 1700,
    "agent_lens.cost.input_usd": 0.0225,
    "agent_lens.cost.output_usd": 0.015,
    "agent_lens.cost.total_usd": 0.0375,
  });
  await sleep(800);

  await sendSpan("thinking", "thinking", 800, {
    "agent_lens.reasoning": "I see the issue. The handler is missing error handling for the async operation on line 42. I need to wrap it in a try-catch block.",
  });
  await sleep(800);

  await sendSpan("edit_file: src/index.ts", "tool_call", 520, {
    "agent_lens.mcp.tool": "edit_file",
    "agent_lens.mcp.server": "filesystem",
    "agent_lens.mcp.arguments": JSON.stringify({
      path: "src/index.ts",
      old_string: "await fetch(url)",
      new_string: "try { await fetch(url) } catch (e) { handleError(e) }",
    }),
  });
  await sleep(800);

  await sendSpan("shell: npm test", "tool_call", 3200, {
    "agent_lens.mcp.tool": "shell_execute",
    "agent_lens.mcp.server": "shell",
    "agent_lens.mcp.arguments": JSON.stringify({ command: "npm test" }),
    "gen_ai.usage.input_tokens": 800,
    "gen_ai.usage.output_tokens": 150,
    "gen_ai.usage.total_tokens": 950,
    "agent_lens.cost.input_usd": 0.012,
    "agent_lens.cost.output_usd": 0.01125,
    "agent_lens.cost.total_usd": 0.02325,
  });
  await sleep(800);

  await sendSpan("thinking", "thinking", 600, {
    "agent_lens.reasoning": "All 47 tests pass. The fix is complete. The async error handling prevents unhandled promise rejections.",
  });

  console.log(`\nDone! ${spanNum} spans sent.`);
  console.log("Open http://localhost:3000 to see them.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
