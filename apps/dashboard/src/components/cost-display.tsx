"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import type { TranslationKey } from "@/lib/i18n";

interface CostDisplayProps {
  spans: Map<string, AgentSpan>;
  t: (key: TranslationKey) => string;
}

export function CostDisplay({ spans, t }: CostDisplayProps) {
  const stats = calculateStats(spans);
  if (stats.totalTokens === 0) return null;

  return (
    <div className="flex items-center gap-2.5 text-xs">
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[--bg-tertiary] rounded-lg">
        <span className="text-[--text-tertiary]">{t("cost.cost")}</span>
        <span className={`font-medium font-mono ${getCostColor(stats.totalCost)}`}>
          ${stats.totalCost < 0.01 ? stats.totalCost.toFixed(4) : stats.totalCost.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[--bg-tertiary] rounded-lg">
        <span className="text-[--text-tertiary]">{t("cost.tokens")}</span>
        <span className="font-mono text-[--text-secondary]">{formatTokens(stats.totalTokens)}</span>
        <span className="text-[--text-tertiary]">
          ({formatTokens(stats.inputTokens)} {t("cost.in")}, {formatTokens(stats.outputTokens)} {t("cost.out")})
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[--bg-tertiary] rounded-lg">
        <span className="text-[--text-tertiary]">{t("cost.llmCalls")}</span>
        <span className="font-mono text-[--text-secondary]">{stats.llmCalls}</span>
      </div>
    </div>
  );
}

export function SpanCostBadge({ span }: { span: AgentSpan }) {
  const cost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
  const tokens = (span.attributes["gen_ai.usage.total_tokens"] as number) ?? 0;
  if (cost === 0 && tokens === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {cost > 0 && (
        <span className={`text-[11px] font-mono ${getCostColor(cost)}`}>
          ${cost < 0.001 ? cost.toFixed(5) : cost.toFixed(3)}
        </span>
      )}
      {tokens > 0 && (
        <span className="text-[11px] font-mono text-[--text-tertiary]">
          {formatTokens(tokens)} tok
        </span>
      )}
    </div>
  );
}

interface CostBreakdownProps {
  span: AgentSpan;
  t?: (key: TranslationKey) => string;
}

export function CostBreakdown({ span, t: tt }: CostBreakdownProps) {
  const inputCost = (span.attributes["agent_lens.cost.input_usd"] as number) ?? 0;
  const outputCost = (span.attributes["agent_lens.cost.output_usd"] as number) ?? 0;
  const totalCost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
  const inputTokens = (span.attributes["gen_ai.usage.input_tokens"] as number) ?? 0;
  const outputTokens = (span.attributes["gen_ai.usage.output_tokens"] as number) ?? 0;
  const model = (span.attributes["gen_ai.response.model"] as string)
    ?? (span.attributes["gen_ai.request.model"] as string) ?? "";

  if (totalCost === 0 && inputTokens === 0 && outputTokens === 0) return null;

  const total = inputCost + outputCost || 1;
  const inputPct = (inputCost / total) * 100;
  const outputPct = (outputCost / total) * 100;

  const label = (key: TranslationKey) => tt?.(key) ?? key;

  return (
    <div>
      <h3 className="text-xs font-semibold text-[--text-tertiary] mb-2">{label("detail.cost")}</h3>
      {model && <div className="text-xs text-[--text-tertiary] mb-2.5 font-mono">{model}</div>}
      <div className="h-2 rounded-full overflow-hidden flex bg-[--bg-tertiary] mb-2.5">
        <div className="bg-blue-500/50 transition-all rounded-l-full" style={{ width: `${inputPct}%` }} />
        <div className="bg-violet-500/50 transition-all rounded-r-full" style={{ width: `${outputPct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500/50" />
          <span className="text-[--text-tertiary]">{label("cost.input")}</span>
          <span className="font-mono ml-auto text-[--text-secondary]">{formatTokens(inputTokens)}</span>
          <span className="font-mono text-blue-400">${inputCost.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500/50" />
          <span className="text-[--text-tertiary]">{label("cost.output")}</span>
          <span className="font-mono ml-auto text-[--text-secondary]">{formatTokens(outputTokens)}</span>
          <span className="font-mono text-violet-400">${outputCost.toFixed(4)}</span>
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-[--border] flex items-center justify-between">
        <span className="text-xs text-[--text-tertiary]">{label("cost.total")}</span>
        <span className={`text-sm font-semibold font-mono ${getCostColor(totalCost)}`}>
          ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

interface CostStats { totalCost: number; inputTokens: number; outputTokens: number; totalTokens: number; llmCalls: number; }

function calculateStats(spans: Map<string, AgentSpan>): CostStats {
  let totalCost = 0, inputTokens = 0, outputTokens = 0, llmCalls = 0;
  for (const span of spans.values()) {
    const cost = (span.attributes["agent_lens.cost.total_usd"] as number) ?? 0;
    const inTok = (span.attributes["gen_ai.usage.input_tokens"] as number) ?? 0;
    const outTok = (span.attributes["gen_ai.usage.output_tokens"] as number) ?? 0;
    if (cost > 0 || inTok > 0 || outTok > 0) { totalCost += cost; inputTokens += inTok; outputTokens += outTok; llmCalls++; }
  }
  return { totalCost, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, llmCalls };
}

function getCostColor(cost: number): string {
  if (cost < 0.01) return "text-emerald-400";
  if (cost < 0.10) return "text-amber-400";
  if (cost < 1.00) return "text-orange-400";
  return "text-red-400";
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
