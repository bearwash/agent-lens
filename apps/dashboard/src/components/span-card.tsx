"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import { SpanCostBadge } from "./cost-display";

const KIND_CONFIG: Record<string, { dot: string; label: string; icon: string }> = {
  thinking:          { dot: "bg-violet-400",  label: "Thinking",    icon: "thought" },
  tool_call:         { dot: "bg-blue-400",    label: "Tool call",   icon: "tool" },
  tool_result:       { dot: "bg-emerald-400", label: "Result",      icon: "result" },
  retry:             { dot: "bg-amber-400",   label: "Retry",       icon: "retry" },
  user_intervention: { dot: "bg-pink-400",    label: "Intervention", icon: "human" },
  branch:            { dot: "bg-rose-400",    label: "Branch",      icon: "branch" },
};

const STATUS_STYLES: Record<string, string> = {
  ok:      "border-[--border]",
  error:   "border-red-500/30 bg-red-500/5",
  pending: "border-blue-500/20",
  paused:  "border-amber-500/20 bg-amber-500/5",
};

interface SpanCardProps {
  span: AgentSpan;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function SpanCard({ span, selected, onClick, onContextMenu }: SpanCardProps) {
  const config = KIND_CONFIG[span.kind] ?? KIND_CONFIG.tool_call;
  const duration = span.endTime ? span.endTime - span.startTime : null;
  const statusStyle = STATUS_STYLES[span.status] ?? STATUS_STYLES.ok;

  // Extract short tool name
  const toolName = span.name.replace(/^tool_call:\s*/, "").replace(/^thinking$/, "");

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e); }}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg border transition-all
        ${statusStyle}
        ${selected ? "bg-[--bg-hover] ring-1 ring-[--accent-blue]/40" : "hover:bg-[--bg-hover]"}
        ${span.status === "pending" ? "span-active" : ""}
        cursor-pointer
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot} ${span.status === "pending" ? "animate-pulse" : ""}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium truncate">
              {toolName || config.label}
            </span>
            {duration !== null && (
              <span className="text-xs text-[--text-tertiary] shrink-0 tabular-nums">
                {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[--text-tertiary]">{config.label}</span>

            {span.attributes["agent_lens.mcp.server"] && (
              <>
                <span className="text-[--text-tertiary]">&middot;</span>
                <span className="text-[11px] text-[--text-tertiary] truncate">
                  {String(span.attributes["agent_lens.mcp.server"]).replace(/^stdio:/, "")}
                </span>
              </>
            )}
          </div>

          {/* Cost badge */}
          <SpanCostBadge span={span} />
        </div>
      </div>

      {/* Approval required banner */}
      {span.attributes["agent_lens.approval_required"] && (
        <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-400 font-medium">
          Waiting for approval
        </div>
      )}
    </button>
  );
}
