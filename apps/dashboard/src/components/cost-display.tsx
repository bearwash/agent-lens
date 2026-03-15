"use client";

import type { AgentSpan } from "@agent-lens/protocol";

interface CostDisplayProps {
  spans: Map<string, AgentSpan>;
}

export function CostDisplay({ spans }: CostDisplayProps) {
  const stats = calculateStats(spans);

  if (stats.totalTokens === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[10px]">
      {/* Cost */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[--bg-tertiary] rounded border border-[--border]">
        <span className="text-[--text-secondary]">Cost:</span>
        <span className={`font-bold ${getCostColor(stats.totalCost)}`}>
          ${stats.totalCost < 0.01
            ? stats.totalCost.toFixed(4)
            : stats.totalCost.toFixed(2)}
        </span>
      </div>

      {/* Tokens */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[--bg-tertiary] rounded border border-[--border]">
        <span className="text-[--text-secondary]">Tokens:</span>
        <span className="font-mono text-[--text-primary]">
          {formatTokens(stats.totalTokens)}
        </span>
        <span className="text-[--text-secondary]">
          ({formatTokens(stats.inputTokens)}in / {formatTokens(stats.outputTokens)}out)
        </span>
      </div>

      {/* Spans with cost */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[--bg-tertiary] rounded border border-[--border]">
        <span className="text-[--text-secondary]">LLM calls:</span>
        <span className="font-mono text-[--text-primary]">{stats.llmCalls}</span>
      </div>
    </div>
  );
}

/** Compact inline cost badge for span cards */
export function SpanCostBadge({ span }: { span: AgentSpan }) {
  const cost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
  const tokens = (span.attributes["gen_ai.usage.total_tokens"] as number) ?? 0;

  if (cost === 0 && tokens === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {cost > 0 && (
        <span className={`text-[9px] font-mono ${getCostColor(cost)}`}>
          ${cost < 0.001 ? cost.toFixed(5) : cost.toFixed(3)}
        </span>
      )}
      {tokens > 0 && (
        <span className="text-[9px] font-mono text-[--text-secondary]">
          {formatTokens(tokens)}tok
        </span>
      )}
    </div>
  );
}

/** Running cost bar for the span detail view */
export function CostBreakdown({ span }: { span: AgentSpan }) {
  const inputCost = (span.attributes["agent_lens.cost.input_usd"] as number) ?? 0;
  const outputCost = (span.attributes["agent_lens.cost.output_usd"] as number) ?? 0;
  const totalCost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
  const inputTokens = (span.attributes["gen_ai.usage.input_tokens"] as number) ?? 0;
  const outputTokens = (span.attributes["gen_ai.usage.output_tokens"] as number) ?? 0;
  const model = (span.attributes["gen_ai.response.model"] as string)
    ?? (span.attributes["gen_ai.request.model"] as string)
    ?? "";

  if (totalCost === 0 && inputTokens === 0 && outputTokens === 0) return null;

  const total = inputCost + outputCost || 1;
  const inputPct = (inputCost / total) * 100;
  const outputPct = (outputCost / total) * 100;

  return (
    <div>
      <h3 className="text-[10px] font-bold tracking-widest text-[--text-secondary] mb-2 uppercase">
        Inference Economics
      </h3>

      {model && (
        <div className="text-xs text-[--text-secondary] mb-2 font-mono">{model}</div>
      )}

      {/* Cost bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-[--bg-primary] mb-2">
        <div
          className="bg-blue-500/60 transition-all"
          style={{ width: `${inputPct}%` }}
          title={`Input: $${inputCost.toFixed(4)}`}
        />
        <div
          className="bg-purple-500/60 transition-all"
          style={{ width: `${outputPct}%` }}
          title={`Output: $${outputCost.toFixed(4)}`}
        />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500/60" />
          <span className="text-[--text-secondary]">Input</span>
          <span className="font-mono ml-auto">{formatTokens(inputTokens)} tok</span>
          <span className="font-mono text-blue-400">${inputCost.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500/60" />
          <span className="text-[--text-secondary]">Output</span>
          <span className="font-mono ml-auto">{formatTokens(outputTokens)} tok</span>
          <span className="font-mono text-purple-400">${outputCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="mt-2 pt-2 border-t border-[--border] flex items-center justify-between">
        <span className="text-[10px] text-[--text-secondary]">Total</span>
        <span className={`text-sm font-bold font-mono ${getCostColor(totalCost)}`}>
          ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ───

interface CostStats {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  llmCalls: number;
}

function calculateStats(spans: Map<string, AgentSpan>): CostStats {
  let totalCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let llmCalls = 0;

  for (const span of spans.values()) {
    const cost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
    const inTok = (span.attributes["gen_ai.usage.input_tokens"] as number) ?? 0;
    const outTok = (span.attributes["gen_ai.usage.output_tokens"] as number) ?? 0;

    if (cost > 0 || inTok > 0 || outTok > 0) {
      totalCost += cost;
      inputTokens += inTok;
      outputTokens += outTok;
      llmCalls++;
    }
  }

  return {
    totalCost,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    llmCalls,
  };
}

function getCostColor(cost: number): string {
  if (cost < 0.01) return "text-green-400";
  if (cost < 0.10) return "text-yellow-400";
  if (cost < 1.00) return "text-orange-400";
  return "text-red-400";
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
