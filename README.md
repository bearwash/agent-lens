<p align="center">
  <br/>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img alt="Agent Lens" src="docs/logo-light.svg" width="360">
  </picture>
  <br/>
  <strong>Time-Travel Debugger for AI Agents</strong>
  <br/><br/>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#openclaw-plugin">OpenClaw</a> &bull;
  <a href="docs/">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OTel-1.37%2B%20GenAI-blue" alt="OTel 1.37+">
  <img src="https://img.shields.io/badge/MCP-2026--03--26-green" alt="MCP Spec">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

<!-- DEMO GIF: Replace with actual recording -->
<p align="center">
  <img src="docs/demo.gif" alt="Agent Lens Demo — Fork, Rewind, Approve" width="720">
  <br/>
  <em>Fork an agent's reasoning at any point. Rewind. Edit. Re-run. Compare branches.</em>
</p>

---

## Why Agent Lens?

Existing tools (LangSmith, Langfuse, etc.) show you logs **after the fact**.

Agent Lens lets you **intervene in real-time** — like `git` for your agent's mind:

```
Agent thinks → chooses tool → ⚡ YOU PAUSE HERE
                                 ├─ Approve as-is
                                 ├─ Modify arguments
                                 ├─ Reject (agent gets error)
                                 └─ Fork → create alternate timeline
```

|  | Log Viewers | Agent Lens |
|--|-------------|------------|
| Real-time streaming | Sometimes | Yes |
| Pause & approve tool calls | No | **Yes** |
| Edit agent reasoning mid-run | No | **Yes** |
| Branch/fork alternate paths | No | **Yes (Git-style)** |
| Compare branch outcomes | No | **Yes** |
| Multimodal attachments | No | **Yes (images, video, sensors)** |
| Live cost tracking | No | **Yes (per-span USD)** |
| OTel GenAI 1.37+ native | Partial | **Full compliance** |
| Runs 100% local | Rarely | **Always** |

## Quick Start

```bash
# Clone & install
git clone https://github.com/yourname/agent-lens.git
cd agent-lens
pnpm install

# Start the proxy + dashboard
pnpm dev
```

Dashboard: [http://localhost:3000](http://localhost:3000) &bull; Proxy WS: `ws://localhost:18790` &bull; HTTP Proxy: `http://localhost:18791`

### Docker

```bash
cd docker
docker compose up
```

This starts PostgreSQL 17 + proxy + dashboard with persistent storage.

### Pipe through an MCP server (stdio mode)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"/tmp/test"}}}' \
  | node apps/proxy/dist/index.js npx @modelcontextprotocol/server-filesystem /tmp
```

### Streamable HTTP proxy

Point your agent's MCP client at `http://localhost:18791` and set `X-MCP-Target` to the real MCP server URL:

```bash
curl -X POST http://localhost:18791 \
  -H "Content-Type: application/json" \
  -H "X-MCP-Target: http://real-mcp-server:8080" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Features

### Approval Gate

Block dangerous tool calls before they execute. Configure rules with glob patterns:

```typescript
// Built-in rules (customizable via UI or API)
{ tool: "shell_*",     risk: "high"     }  // Shell commands
{ tool: "*delete*",    risk: "critical" }  // Destructive ops
{ tool: "*write*",     risk: "medium"   }  // File writes (off by default)
```

When triggered: agent pauses → you see the full request in the dashboard → approve / reject / modify arguments.

### Time-Travel Branching

Right-click any span → **Fork Here** → agent restarts from that point with your edits.

- Both the original path and new branch are preserved
- Compare outcomes across branches
- Unlimited branch depth (branches can fork from branches)

### Multimodal Attachments

View screenshots, images, sensor data, and video directly in the timeline. See exactly what the agent "saw" when it made a decision.

### Inference Economics

Real-time cost tracking per span and cumulative across the session:

- Input/output token breakdown
- USD cost with model-specific pricing
- Color-coded thresholds (green → yellow → orange → red)
- Pre-loaded pricing for Claude, GPT, Gemini families

### OTel GenAI 1.37+ Full Compliance

Every span emits standard attributes:

```
gen_ai.system              gen_ai.request.model
gen_ai.request.temperature gen_ai.request.max_tokens
gen_ai.response.id         gen_ai.response.finish_reason
gen_ai.usage.input_tokens  gen_ai.usage.output_tokens
gen_ai.task                gen_ai.action
```

Export to Datadog, Grafana, Jaeger, or any OTLP-compatible backend with zero configuration.

## Architecture

```
┌─────────────┐     stdio/HTTP      ┌──────────────┐     JSON-RPC     ┌────────────┐
│   Agent      │ ──────────────────→ │  Agent Lens  │ ──────────────→ │ MCP Server │
│ (OpenClaw,   │ ←────────────────── │    Proxy     │ ←────────────── │            │
│  Claude Code)│    responses        │              │   responses     └────────────┘
└─────────────┘                      │  ┌────────┐  │
                                     │  │OTel    │  │
                                     │  │Spans   │  │──→ OTLP Export
                                     │  └────────┘  │
                                     │  ┌────────┐  │     WebSocket
                                     │  │Approval│  │──→ ┌───────────┐
                                     │  │Gate    │  │    │ Dashboard │
                                     │  └────────┘  │←── │ (Next.js) │
                                     └──────────────┘    └───────────┘
                                           │
                                     ┌─────┴─────┐
                                     │  Store    │
                                     │ (Memory / │
                                     │  PG+WORM) │
                                     └───────────┘
```

## OpenClaw Plugin

Register Agent Lens as an OpenClaw context-engine plugin:

```typescript
import { createPlugin } from "@agent-lens/openclaw-plugin";

const agentLens = createPlugin({
  proxyUrl: "ws://localhost:18790",
  agentSystem: "openclaw",
  model: "claude-opus-4-6",
});

// In your OpenClaw configuration
export default {
  plugins: [agentLens],
};
```

## Monorepo Structure

```
agent-lens/
├── apps/
│   ├── dashboard/              # Next.js 15+ real-time UI
│   └── proxy/                  # MCP observation proxy (stdio + Streamable HTTP)
├── packages/
│   ├── protocol/               # Shared TypeScript types
│   ├── otel-config/            # OTel 1.37+ GenAI span helpers + cost calculator
│   ├── store/                  # Storage abstraction (MemoryStore + PostgreSQL)
│   └── openclaw-plugin/        # OpenClaw context-engine integration
├── docker/                     # Docker Compose (PG + proxy + dashboard)
└── pnpm-workspace.yaml
```

## Roadmap

- [x] Phase 1: Real-time span visualization
- [x] Phase 2: Approval Gate + stdio/HTTP proxy
- [x] Phase 3: Time-travel branching (Fork & Rewind)
- [x] Multimodal attachment viewer
- [x] Inference cost tracking
- [x] OTel 1.37+ full compliance + OTLP export
- [x] PostgreSQL persistent storage (WORM)
- [x] OpenClaw plugin
- [ ] Visual branch diff comparison
- [ ] Collaborative approval (secure elicitation URLs)
- [ ] ClawHub marketplace listing
- [ ] Rust high-throughput proxy

## License

MIT
