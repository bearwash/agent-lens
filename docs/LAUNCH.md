# Agent Lens — Launch Protocol

## Pre-Launch Checklist

- [ ] Record 30-second hero GIF (`pnpm demo` + screen capture)
- [ ] Save as `docs/demo.gif` (720px wide, optimize to <5MB)
- [ ] Verify README renders correctly on GitHub
- [ ] Set repository to **Public**
- [ ] Add topics: `ai-agent`, `debugger`, `mcp`, `opentelemetry`, `openclaw`, `time-travel`, `typescript`

## Launch Sequence

### Day 1: ClawHub + Hacker News

**1. ClawHub (OpenClaw Marketplace)** — Primary channel

Register via `clawhub.json` in repo root (already created).

Category: `debug-stack`
Target audience: OpenClaw's 250K+ user base.

**2. Hacker News — Show HN**

Post at: **9:00 AM ET (22:00-23:00 JST)**
This captures both European end-of-day traffic and North American morning traffic simultaneously.

Title format:
```
Show HN: Agent Lens – Time-travel debugger for AI agents (fork reasoning like git branches)
```

Key points for the HN post:
- Lead with the problem: "AI agents execute 20-step chains and you only see the log after it fails"
- Emphasize local-first: "No cloud. No telemetry. Your agent's reasoning never leaves your machine"
- Mention OTel compliance: HN audience respects standards over proprietary lock-in
- Link directly to the demo GIF

**3. Reddit** — Same day, staggered by 2-4 hours

| Subreddit | Angle |
|-----------|-------|
| r/OpenAI | "Built a time-travel debugger for agents — fork their reasoning when they go wrong" |
| r/SideProject | "I built a local-first debugger that lets you rewind and branch AI agent thinking" |
| r/OpenClaw | "Agent Lens: Official debug tool for OpenClaw — approval gates + time-travel branching" |
| r/MachineLearning | "OTel-compliant observation proxy for GenAI agents with real-time cost tracking" |

### Day 2-3: Follow-up

- Respond to every HN comment within 2 hours
- Post a "How it works" thread on Twitter/X with architecture diagram
- Submit to DevHunt, Product Hunt (schedule for following Tuesday 00:01 PST)

### Week 2: Content

- Write a blog post: "Why Post-Mortem Debugging Doesn't Work for AI Agents"
- Record a 3-minute YouTube demo walkthrough
- Submit talk proposal to AI Engineer Summit

## Metrics to Track

| Metric | Target (Week 1) | Target (Month 1) |
|--------|-----------------|-------------------|
| GitHub Stars | 1,000+ | 5,000+ |
| ClawHub installs | 500+ | 2,000+ |
| HN points | 100+ | — |
| Contributors | 5+ | 20+ |
