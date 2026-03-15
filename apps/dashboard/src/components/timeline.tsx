"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import { SpanCard } from "./span-card";

interface TimelineProps {
  spans: AgentSpan[];
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string) => void;
  onSpanContextMenu: (span: AgentSpan, position: { x: number; y: number }) => void;
}

export function Timeline({ spans, selectedSpanId, onSelectSpan, onSpanContextMenu }: TimelineProps) {
  if (spans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[--text-secondary] gap-3">
        <div className="text-4xl opacity-20">
          {"{ }"}
        </div>
        <div className="text-sm">Waiting for agent activity...</div>
        <div className="text-xs opacity-50">
          Connect an agent through the MCP proxy to start observing
        </div>
      </div>
    );
  }

  // Group spans by branch
  const branches = new Map<string, AgentSpan[]>();
  for (const span of spans) {
    const branchId = (span.attributes["agent_lens.branch_id"] as string) ?? "main";
    const list = branches.get(branchId) ?? [];
    list.push(span);
    branches.set(branchId, list);
  }

  return (
    <div className="p-3 space-y-4 overflow-y-auto h-full">
      {[...branches.entries()].map(([branchId, branchSpans]) => (
        <div key={branchId}>
          {branches.size > 1 && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div
                className={`w-3 h-0.5 rounded ${branchId === "main" ? "bg-blue-400" : "bg-pink-400"}`}
              />
              <span className="text-[10px] font-bold tracking-widest text-[--text-secondary] uppercase">
                {branchId === "main" ? "Main Branch" : `Branch: ${branchId.slice(0, 8)}`}
              </span>
            </div>
          )}
          <div className="space-y-2">
            {branchSpans.map((span) => (
              <SpanCard
                key={span.spanId}
                span={span}
                selected={span.spanId === selectedSpanId}
                onClick={() => onSelectSpan(span.spanId)}
                onContextMenu={(e) =>
                  onSpanContextMenu(span, { x: e.clientX, y: e.clientY })
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
