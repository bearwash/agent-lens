"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import { SpanCostBadge } from "./cost-display";

const KIND_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  thinking:          { bg: "bg-purple-500/10", border: "border-purple-500/30",  label: "THINK" },
  tool_call:         { bg: "bg-blue-500/10",   border: "border-blue-500/30",    label: "CALL" },
  tool_result:       { bg: "bg-green-500/10",  border: "border-green-500/30",   label: "RESULT" },
  retry:             { bg: "bg-yellow-500/10", border: "border-yellow-500/30",  label: "RETRY" },
  user_intervention: { bg: "bg-pink-500/10",   border: "border-pink-500/30",    label: "HUMAN" },
  branch:            { bg: "bg-pink-500/10",   border: "border-pink-500/30",    label: "BRANCH" },
};

const STATUS_DOT: Record<string, string> = {
  ok:      "bg-green-400",
  error:   "bg-red-400",
  pending: "bg-blue-400 animate-pulse",
  paused:  "bg-yellow-400 animate-pulse",
};

interface SpanCardProps {
  span: AgentSpan;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function SpanCard({ span, selected, onClick, onContextMenu }: SpanCardProps) {
  const style = KIND_STYLES[span.kind] ?? KIND_STYLES.tool_call;
  const duration = span.endTime ? span.endTime - span.startTime : null;

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      className={`
        w-full text-left p-3 rounded-lg border transition-all
        ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-blue-400/50" : ""}
        ${span.status === "pending" ? "span-active" : ""}
        hover:brightness-125 cursor-pointer
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${STATUS_DOT[span.status]}`} />
          <span className="text-[10px] font-bold tracking-widest opacity-60">
            {style.label}
          </span>
        </div>
        {duration !== null && (
          <span className="text-[10px] opacity-50">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      <div className="text-sm font-medium truncate">{span.name}</div>

      {span.attributes["agent_lens.mcp.server"] && (
        <div className="text-[11px] opacity-40 mt-1 truncate">
          {span.attributes["agent_lens.mcp.server"] as string}
        </div>
      )}

      {/* Cost & token badge */}
      <SpanCostBadge span={span} />

      {/* Attachment indicator */}
      {span.attributes["agent_lens.attachments"] && (
        <div className="mt-1 text-[9px] text-cyan-400 opacity-70">
          ATT
        </div>
      )}

      {span.attributes["agent_lens.approval_required"] && (
        <div className="mt-2 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] text-yellow-300 font-bold tracking-wider">
          APPROVAL REQUIRED
        </div>
      )}
    </button>
  );
}
