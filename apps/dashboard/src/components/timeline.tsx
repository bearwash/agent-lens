"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import type { TranslationKey } from "@/lib/i18n";
import { SpanCard } from "./span-card";

interface TimelineProps {
  spans: AgentSpan[];
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string) => void;
  onSpanContextMenu: (span: AgentSpan, position: { x: number; y: number }) => void;
  t: (key: TranslationKey) => string;
}

export function Timeline({ spans, selectedSpanId, onSelectSpan, onSpanContextMenu, t }: TimelineProps) {
  if (spans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[--text-secondary] gap-3 px-6">
        <div className="w-10 h-10 rounded-xl bg-[--bg-tertiary] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--text-tertiary]">
            <circle cx="10" cy="10" r="7"/><path d="M10 7v3l2 2"/>
          </svg>
        </div>
        <div className="text-sm font-medium text-center">{t("timeline.waiting")}</div>
        <div className="text-xs text-[--text-tertiary] text-center leading-relaxed">{t("timeline.waitingDesc")}</div>
      </div>
    );
  }

  const branches = new Map<string, AgentSpan[]>();
  for (const span of spans) {
    const branchId = (span.attributes["agent_lens.branch_id"] as string) ?? "main";
    const list = branches.get(branchId) ?? [];
    list.push(span);
    branches.set(branchId, list);
  }

  return (
    <div className="p-2 space-y-3 overflow-y-auto h-full">
      {[...branches.entries()].map(([branchId, branchSpans]) => (
        <div key={branchId}>
          {branches.size > 1 && (
            <div className="flex items-center gap-2 mb-1.5 px-2 py-1">
              <div className={`w-2.5 h-0.5 rounded-full ${branchId === "main" ? "bg-blue-400" : "bg-rose-400"}`} />
              <span className="text-[11px] font-medium text-[--text-tertiary]">
                {branchId === "main" ? t("timeline.main") : branchId.slice(0, 8)}
              </span>
            </div>
          )}
          <div className="space-y-1">
            {branchSpans.map((span) => (
              <SpanCard
                key={span.spanId} span={span}
                selected={span.spanId === selectedSpanId}
                onClick={() => onSelectSpan(span.spanId)}
                onContextMenu={(e) => onSpanContextMenu(span, { x: e.clientX, y: e.clientY })}
                t={t}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
