<p align="center">
  <br/>
  <img src="docs/agent-lens-banner.svg" alt="Agent Lens" width="600">
  <br/><br/>
  <strong>The Git for AI Agents:</strong><br/>
  <strong>Rewind, Branch, and Debug Multi-step Reasoning in Real-time.</strong>
  <br/><br/>
</p>

<p align="center">
  <a href="#30-second-demo">Demo</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#inference-economics">Cost Tracking</a> &bull;
  <a href="#openclaw-integration">OpenClaw</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="docs/">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built_for-OpenClaw_Ecosystem-ff6b35?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJMMyA3djEwbDkgNSA5LTVWN2wtOS01eiIvPjwvc3ZnPg==" alt="Built for OpenClaw Ecosystem">
  <br/>
  <img src="https://img.shields.io/badge/OTel-1.37%2B_GenAI_Full_Compliance-4f8ff7?style=flat-square" alt="OTel 1.37+">
  <img src="https://img.shields.io/badge/MCP-2026--03--26_Streamable_HTTP-34d399?style=flat-square" alt="MCP Spec">
  <img src="https://img.shields.io/badge/100%25-Local_First-a78bfa?style=flat-square" alt="Local First">
  <img src="https://img.shields.io/badge/License-MIT-fbbf24?style=flat-square" alt="License">
</p>

---

## 30-Second Demo

<!-- HERO GIF: Record with `pnpm demo` then capture with any screen recorder -->
<p align="center">
  <img src="docs/demo.gif" alt="Agent Lens Demo — Time-Travel Debugging" width="720">
</p>

> **What you're seeing:** An OpenClaw agent tries to fix a broken API endpoint. It edits the wrong file at step 8. The operator right-clicks that span, selects **"Fork Here"**, adjusts the context, and watches the agent take the correct path on a new branch — all while the original (failed) timeline is preserved for comparison. Cost: $0.03 for the fix, vs $0.47 wasted on the wrong path.

```
Agent thinks  ──→  reads file  ──→  searches code  ──→  ⚡ shell_execute
                                                          │
                                                    APPROVAL GATE
                                                    ┌─────────────────┐
                                                    │ rm -rf ./cache  │
                                                    │                 │
                                                    │ [Risk: HIGH]    │
                                                    │                 │
                                                    │ ✅ Approve      │
                                                    │ ✏️  Modify       │
                                                    │ ❌ Reject       │
                                                    └─────────────────┘
                                                          │
                    edits wrong file (step 8) ←───────────┘
                          │
                    ⚡ RIGHT-CLICK → "Fork Here"
                          │
              ┌───────────┴───────────┐
              │                       │
         [Original]              [New Branch]
         ❌ wrong fix             ✅ correct fix
         $0.47 wasted             $0.03 cost
```

<details>
<summary><strong>Run the demo yourself</strong></summary>

```bash
git clone https://github.com/bearwash/agent-lens.git
cd agent-lens && pnpm install

# Terminal 1: Start proxy + dashboard
pnpm dev

# Terminal 2: Run the demo scenario
pnpm --filter @agent-lens/proxy run demo

# Open http://localhost:3000 and watch the magic
```

</details>

---

## Why Does This Matter Now?

In 2026, AI agents autonomously execute multi-step tasks — booking flights, deploying code, managing infrastructure. When they go wrong, the damage is real:

| Problem | Scale |
|---------|-------|
| Enterprise inference costs | **$10M+/month** and growing 40% QoQ |
| Agent errors caught post-hoc | Average **$2,400** per incident to remediate |
| Regulatory compliance (AI Safety Act) | **Mandatory audit trails** by Q4 2026 |

**Existing tools show you the crash report. Agent Lens gives you the steering wheel.**

LangSmith, Langfuse, and Datadog GenAI Monitoring are *post-mortem* tools. None of them let you:

- **Pause** an agent mid-execution to inspect a dangerous tool call
- **Edit** the agent's reasoning and re-run from any checkpoint
- **Branch** the timeline to compare "what if?" scenarios
- **Track cost in real-time** per reasoning step, per branch

Agent Lens does all of this, **100% local**, with **zero cloud dependency**.

---

## Quick Start

```bash
# Clone & install
git clone https://github.com/bearwash/agent-lens.git
cd agent-lens
pnpm install

# Start everything
pnpm dev
```

| Service | URL |
|---------|-----|
| Dashboard | [http://localhost:3000](http://localhost:3000) |
| Proxy WebSocket | `ws://localhost:18790` |
| HTTP Proxy | `http://localhost:18791` |
| REST API | `http://localhost:18790/api/*` |

### Docker (with PostgreSQL)

```bash
cd docker && docker compose up
```

Starts PostgreSQL 17 (WORM storage) + proxy + dashboard. Your agent's reasoning history is persisted and tamper-proof.

### Connect Your Agent

**stdio mode** — wrap any MCP server:
```bash
# Agent Lens sits between your agent and the MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file"}}' \
  | node apps/proxy/dist/index.js npx @your/mcp-server
```

**Streamable HTTP mode** — transparent proxy:
```bash
# Point your agent at Agent Lens, set X-MCP-Target to the real server
curl -X POST http://localhost:18791 \
  -H "Content-Type: application/json" \
  -H "X-MCP-Target: https://your-mcp-server.com" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## Features

### Approval Gate — Stop Dangerous Actions Before They Execute

```typescript
// Built-in rules (fully customizable)
{ tool: "shell_*",    risk: "high"     }  // Block shell commands
{ tool: "*delete*",   risk: "critical" }  // Block destructive ops
{ tool: "*payment*",  risk: "critical" }  // Block financial actions
```

When a rule matches, the agent **freezes**. You see the full request in the dashboard and choose:
- **Approve** — let it through
- **Modify** — change the arguments, then approve
- **Reject** — agent receives an error and must adapt

No more "the agent deleted production data while I was at lunch."

### Time-Travel Branching — `git checkout` for Agent Reasoning

Right-click any span in the timeline → **Fork Here** → the agent restarts from that exact checkpoint.

- **Both timelines are preserved** — the failed path and the corrected path live side by side
- **Compare branch outcomes** — see which approach was cheaper, faster, more correct
- **Unlimited depth** — branches can fork from branches
- **Git-style tree visualization** — see the full reasoning topology at a glance

This is the feature that doesn't exist anywhere else. Not in LangSmith. Not in Langfuse. Not in Datadog.

### Multimodal Attachment Viewer

2026 agents handle images, screenshots, video, and sensor data. Agent Lens renders them inline:

- **Screenshots**: See exactly what the agent "saw" when it clicked that button
- **Images**: Camera input, generated diagrams, chart captures
- **Video/Audio**: Playback directly in the span detail panel
- **Sensor data**: IoT device readings with metadata overlay

Debug "why did the agent click the wrong button?" by viewing the screenshot **at that exact reasoning step**.

---

## Inference Economics

> *"We were spending $340K/month on agent inference before we could even see which steps were burning tokens."*
> — Every enterprise AI team in 2026

Agent Lens tracks **cost per reasoning step** in real-time:

```
┌──────────────────────────────────────────────┐
│  Session Cost: $1.24          Tokens: 847.2k │
│  ████████████░░░░░░░░  Input: 612k ($0.31)   │
│  ██████████████████░░  Output: 235k ($0.93)  │
│                                              │
│  LLM Calls: 23    Avg: $0.054/call           │
└──────────────────────────────────────────────┘
```

**Per-span breakdown:**
- Input vs. output token split with cost in USD
- Color-coded severity: 🟢 < $0.01 → 🟡 < $0.10 → 🟠 < $1.00 → 🔴 $1.00+
- **Branch cost comparison**: "The corrected branch cost $0.03. The original mistake cost $0.47."

**Pre-loaded pricing** for Claude (Opus/Sonnet/Haiku), GPT-4o/4.1, Gemini 3 Pro/Flash. Custom models supported.

When you fork a branch to try a different approach, you can see **exactly how much each experiment costs** before committing to a strategy. This turns agent debugging from guesswork into engineering.

---

## OTel GenAI 1.37+ — Full Compliance, Zero Config

Every span emits the complete [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) attribute set:

| Attribute | Description |
|-----------|-------------|
| `gen_ai.system` | Provider: `openclaw`, `claude`, `openai` |
| `gen_ai.request.model` | Requested model ID |
| `gen_ai.response.model` | Actual model used |
| `gen_ai.response.finish_reason` | `stop`, `length`, `tool_use`, `content_filter` |
| `gen_ai.usage.input_tokens` | Input token count |
| `gen_ai.usage.output_tokens` | Output token count |
| `gen_ai.task` | High-level task description |
| `gen_ai.action` | Tool name or action taken |

**Export anywhere** — built-in `toOtlpSpan()` converter sends data to Datadog, Grafana, Jaeger, or any OTLP-compatible backend. Agent Lens isn't a walled garden; it's a **standards-compliant observation layer** that plays nicely with your existing stack.

---

## OpenClaw Integration

Agent Lens is built as a first-class [OpenClaw](https://github.com/openclaw) `context-engine` plugin:

```typescript
import { createPlugin } from "@agent-lens/openclaw-plugin";

export default {
  plugins: [
    createPlugin({
      proxyUrl: "ws://localhost:18790",
      agentSystem: "openclaw",
      model: "claude-opus-4-6",
    }),
  ],
};
```

**Hooks into three OpenClaw lifecycle events:**
- `bootstrap` — initializes the debug session
- `ingest` — converts gateway events to OTel spans in real-time
- `assemble` — injects approval gate context into LLM prompts

Works with OpenClaw v2026.3.7+ via the Gateway WebSocket API on port 18789.

---

## Architecture

```
┌─────────────┐                        ┌──────────────┐                    ┌────────────┐
│             │     stdio / HTTP       │              │     JSON-RPC      │            │
│   Agent     │ ─────────────────────→ │  Agent Lens  │ ─────────────────→│ MCP Server │
│             │ ←───────────────────── │    Proxy     │ ←─────────────────│            │
│  OpenClaw   │     responses          │              │    responses      └────────────┘
│  Claude Code│                        │  ┌────────┐  │
│  Custom     │                        │  │ OTel   │  │───→ OTLP Export (Datadog, Grafana, Jaeger)
└─────────────┘                        │  │ Spans  │  │
                                       │  └────────┘  │
                                       │  ┌────────┐  │     WebSocket
                                       │  │Approval│  │───→ ┌───────────────────────────┐
                                       │  │ Gate   │  │     │      Dashboard            │
                                       │  └────────┘  │←─── │   Next.js 15 + Tailwind   │
                                       │  ┌────────┐  │     │                           │
                                       │  │ Cost   │  │     │  ┌─────┐ ┌──────┐ ┌────┐ │
                                       │  │Tracker │  │     │  │Time │ │Span  │ │Cost│ │
                                       │  └────────┘  │     │  │line │ │Detail│ │Bar │ │
                                       └──────────────┘     │  └─────┘ └──────┘ └────┘ │
                                              │             └───────────────────────────┘
                                       ┌──────┴──────┐
                                       │   Store     │
                                       │ ┌─────────┐ │
                                       │ │In-Memory│ │  ← Dev mode
                                       │ └─────────┘ │
                                       │ ┌─────────┐ │
                                       │ │ Postgres│ │  ← Production (WORM / Audit)
                                       │ │ 17+pgau │ │
                                       │ └─────────┘ │
                                       └─────────────┘
```

## Monorepo

```
agent-lens/
├── apps/
│   ├── dashboard/              # Next.js 15 + Tailwind v4 — real-time debug UI
│   └── proxy/                  # MCP observation proxy (stdio + Streamable HTTP)
├── packages/
│   ├── protocol/               # Shared TypeScript types (MCP, OTel, Branches)
│   ├── otel-config/            # OTel 1.37+ GenAI helpers + cost calculator + OTLP export
│   ├── store/                  # Storage abstraction (MemoryStore + PgStore WORM)
│   └── openclaw-plugin/        # OpenClaw context-engine integration
├── docker/                     # Docker Compose (PostgreSQL 17 + proxy + dashboard)
├── pnpm-workspace.yaml
└── 4,200+ lines of TypeScript
```

---

## Roadmap

### Delivered

- [x] **Phase 1**: Real-time span visualization with WebSocket streaming
- [x] **Phase 2**: Approval Gate — pause, inspect, modify dangerous tool calls
- [x] **Phase 3**: Time-travel branching — Fork, Rewind, compare alternate timelines
- [x] **Multimodal**: Inline image/video/screenshot viewer per span
- [x] **Inference Economics**: Per-span USD cost tracking with cumulative display
- [x] **OTel 1.37+**: Full GenAI Semantic Conventions + OTLP export
- [x] **PostgreSQL WORM**: Append-only audit-grade storage with pgaudit
- [x] **OpenClaw Plugin**: First-class context-engine integration

### Phase 4: Compliance & Scale (Next)

- [ ] **Reconstitution of Intent** — Export append-only PostgreSQL logs as legally admissible audit trails, compliant with the 2026 AI Safety Act. Every reasoning step, tool call, and human intervention is cryptographically timestamped and immutable.
- [ ] **P2P Debug Sync** — Sync debug sessions across devices (PC ↔ tablet ↔ phone) using libp2p, with zero server infrastructure. Inspect an agent's live reasoning from your phone while it runs on your workstation.
- [ ] **Visual Branch Diff** — Side-by-side comparison of branch outcomes with token/cost delta highlighting
- [ ] **Collaborative Approval** — Generate secure one-time URLs for manager/stakeholder approval of high-risk actions
- [ ] **ClawHub Marketplace** — Official listing as OpenClaw's recommended debug stack
- [ ] **Rust High-Throughput Proxy** — Handle 10,000+ spans/sec for production fleet monitoring

---

## Contributing

Agent Lens is MIT licensed. Contributions welcome.

```bash
# Development
pnpm install
pnpm dev          # Start proxy + dashboard
pnpm build        # Build all packages
pnpm typecheck    # Type-check everything

# Demo
pnpm --filter @agent-lens/proxy run demo
```

---

<p align="center">
  <br/>
  <strong>Stop reading crash reports. Start steering your agents.</strong>
  <br/><br/>
  <a href="#quick-start">Get Started</a> &bull;
  <a href="https://github.com/bearwash/agent-lens/issues">Report Issue</a> &bull;
  <a href="https://github.com/bearwash/agent-lens/discussions">Discuss</a>
  <br/><br/>
  MIT License &copy; 2026
</p>
