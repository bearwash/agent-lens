"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import type { TranslationKey } from "@/lib/i18n";
import { SpanCostBadge } from "./cost-display";

const KIND_KEYS: Record<string, TranslationKey> = {
  thinking: "kind.thinking",
  tool_call: "kind.tool_call",
  tool_result: "kind.tool_result",
  retry: "kind.retry",
  user_intervention: "kind.user_intervention",
  branch: "kind.branch",
};

const KIND_DOTS: Record<string, string> = {
  thinking: "bg-violet-400",
  tool_call: "bg-blue-400",
  tool_result: "bg-emerald-400",
  retry: "bg-amber-400",
  user_intervention: "bg-pink-400",
  branch: "bg-rose-400",
};

const STATUS_STYLES: Record<string, string> = {
  ok: "border-[--border]",
  error: "border-red-500/30 bg-red-500/5",
  pending: "border-blue-500/20",
  paused: "border-amber-500/20 bg-amber-500/5",
};

interface SpanCardProps {
  span: AgentSpan;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  t: (key: TranslationKey) => string;
}

export function SpanCard({ span, selected, onClick, onContextMenu, t }: SpanCardProps) {
  const kindLabel = t(KIND_KEYS[span.kind] ?? "kind.tool_call");
  const dotColor = KIND_DOTS[span.kind] ?? "bg-blue-400";
  const duration = span.endTime ? span.endTime - span.startTime : null;
  const statusStyle = STATUS_STYLES[span.status] ?? STATUS_STYLES.ok;
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
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${span.status === "pending" ? "animate-pulse" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium truncate">{toolName || kindLabel}</span>
            {duration !== null && (
              <span className="text-xs text-[--text-tertiary] shrink-0 tabular-nums">
                {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[--text-tertiary]">{kindLabel}</span>
            {span.attributes["agent_lens.mcp.server"] && (
              <>
                <span className="text-[--text-tertiary]">&middot;</span>
                <span className="text-[11px] text-[--text-tertiary] truncate">
                  {String(span.attributes["agent_lens.mcp.server"]).replace(/^stdio:/, "")}
                </span>
              </>
            )}
          </div>
          <SpanCostBadge span={span} />
        </div>
      </div>
      {span.attributes["agent_lens.approval_required"] && (
        <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-400 font-medium">
          {t("approval.waiting")}
        </div>
      )}
    </button>
  );
}
