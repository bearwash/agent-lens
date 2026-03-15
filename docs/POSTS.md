# Agent Lens — Launch Post Templates

## 1. Hacker News (Show HN)

**Post at: 9:00 AM ET / 22:00 JST**

### Title
```
Show HN: Agent Lens – Git-style time-travel debugger for AI agents (fork, rewind, approve)
```

### Body (Text post)
```
Hey HN,

I built Agent Lens, an open-source debugger that sits between AI agents
(OpenClaw, Claude Code, etc.) and their MCP tool servers. It lets you:

1. PAUSE agents mid-execution when they're about to do something dangerous
   (shell_execute, file deletion, payments) — "Approval Gate"

2. FORK the agent's reasoning at any point — like `git checkout -b` for
   the agent's mind. Both timelines are preserved for comparison.

3. REWIND to any step and re-run with edited context

4. TRACK COST per reasoning step in real-time (USD per span). When you
   fork to try a different approach, you see exactly how much each
   experiment costs.

5. VIEW what the agent "saw" — screenshots, images, sensor data inline
   in the timeline

Everything runs 100% local. No cloud. No telemetry. Your agent's
chain-of-thought never leaves your machine.

Built on OpenTelemetry 1.37+ GenAI Semantic Conventions, so spans export
to Datadog/Grafana/Jaeger with zero config. Includes an Agentic Firewall
that checks tool calls against known threat patterns (including
CVE-2026-25253 token theft).

Stack: TypeScript, Next.js, WebSocket, PostgreSQL (WORM audit storage).

Demo: [link to demo GIF]
Repo: https://github.com/bearwash/agent-lens

I'd love feedback on the branching UX — is the Git mental model the right
one for debugging agent reasoning?
```

---

## 2. Reddit Posts

### r/OpenAI

**Title:**
```
I built an open-source debugger that lets you "time-travel" through AI agent reasoning — fork their thinking when they go wrong, like git branches
```

**Body:**
```
Existing tools (LangSmith, Langfuse) show you logs after the agent fails.

Agent Lens lets you intervene WHILE it's running:

- Agent is about to run `rm -rf`? → It pauses. You approve or reject.
- Agent edited the wrong file? → Right-click → "Fork Here" → fix the
  context → watch it take the correct path on a new branch.
- Curious how much that 15-step chain cost? → Every span shows USD cost
  in real-time.

Works with any agent that uses MCP (Model Context Protocol) — OpenClaw,
Claude Code, custom agents.

100% local, 100% open source (MIT).

GitHub: https://github.com/bearwash/agent-lens

[demo GIF]
```

### r/SideProject

**Title:**
```
I built a time-travel debugger for AI agents — rewind, branch, and approve their reasoning in real-time [Open Source]
```

**Body:**
```
Problem: AI agents execute 20-step chains autonomously. When step 12
goes wrong, you only find out after step 20 fails. By then you've burned
tokens and time.

Solution: Agent Lens sits between your agent and its tools. It records
every reasoning step as an OpenTelemetry span, and gives you a real-time
dashboard where you can:

- Pause dangerous tool calls (Approval Gate)
- Fork the timeline at any point (like git branches)
- Track inference cost per step ($USD)
- View multimodal attachments (screenshots, images)

Built as a transparent MCP proxy — works with stdio and Streamable HTTP.
No code changes needed in your agent.

Tech: TypeScript monorepo, Next.js dashboard, WebSocket streaming,
PostgreSQL with WORM audit storage.

4,200 lines of TypeScript. MIT license.

https://github.com/bearwash/agent-lens
```

### r/MachineLearning

**Title:**
```
[P] Agent Lens: OTel-compliant observation proxy for GenAI agents with real-time cost tracking and time-travel branching
```

**Body:**
```
We've been building an observation and intervention layer for autonomous
AI agents, fully compliant with OpenTelemetry 1.37+ GenAI Semantic
Conventions.

Key technical details:

- Transparent MCP proxy (stdio + Streamable HTTP 2026-03-26 spec)
- Every agent step recorded as OTel spans with gen_ai.* attributes
- Built-in OTLP export to Datadog, Grafana, Jaeger
- Agentic Firewall: regex-based IOC matching against tool call arguments
  (covers CVE-2026-25253 token theft pattern)
- Git-style branching: fork agent reasoning at any span, both timelines
  preserved with cost deltas
- WORM storage via PostgreSQL for audit compliance (AI Safety Act 2026)
- SHA-256 chained audit trail for "Reconstitution of Intent"

Unlike LangSmith/Langfuse, this is not post-mortem — it's real-time
intervention with approval gates that pause execution before dangerous
tool calls.

Open source (MIT): https://github.com/bearwash/agent-lens

Paper-like writeup on the architecture coming soon. Feedback welcome,
especially on the OTel GenAI semantic convention mapping.
```

---

## 3. Twitter/X Thread

```
🧵 I built "git" for AI agents.

When your agent goes off the rails at step 12 of a 20-step chain,
you shouldn't have to start over.

Agent Lens lets you REWIND to step 12, FORK the timeline,
and watch the agent take a different path.

Here's how it works ↓

[1/6] THE PROBLEM

AI agents in 2026 execute complex multi-step tasks autonomously.
When they fail, existing tools show you the crash report.

That's like debugging a car crash by reading the police report.
You need the dashcam footage AND the steering wheel.

[2/6] APPROVAL GATE

Agent Lens sits between your agent and its tools.
When the agent tries to run `rm -rf` or access credentials,
it PAUSES and asks you first.

You approve, modify, or reject — then it continues.

[demo screenshot]

[3/6] TIME-TRAVEL BRANCHING

Right-click any step → "Fork Here"

The agent restarts from that checkpoint with your edits.
Both the original (failed) path and the new path are preserved.

Like `git checkout -b fix/correct-approach` but for reasoning.

[demo screenshot]

[4/6] INFERENCE ECONOMICS

Every step shows token count and USD cost in real-time.

When you fork to try a different approach, you see:
"Original mistake: $0.47. Corrected branch: $0.03."

Turns agent debugging from guesswork into engineering.

[5/6] AGENTIC FIREWALL

Built-in threat detection checks every tool call against
known attack patterns (including CVE-2026-25253 token theft).

Not just a debugger — it's a security layer for autonomous agents.

[6/6] 100% local. No cloud. MIT license.

Works with OpenClaw, Claude Code, any MCP-compatible agent.
Full OTel 1.37+ GenAI compliance — export to Datadog/Grafana.

GitHub: https://github.com/bearwash/agent-lens

Star it if you think agents need a steering wheel, not just a dashcam.
```

---

## 4. Product Hunt Tagline

**Tagline:** The Git for AI Agents — Rewind, Branch, and Debug Reasoning in Real-time

**Description:**
Agent Lens is a time-travel debugger for AI agents. Pause dangerous actions,
fork the agent's reasoning like git branches, track inference costs per step,
and view multimodal attachments — all 100% local with zero cloud dependency.
Built on OpenTelemetry standards. Works with OpenClaw, Claude Code, and any
MCP-compatible agent.
