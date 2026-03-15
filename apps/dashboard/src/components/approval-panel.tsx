"use client";

import { useState } from "react";
import type { ApprovalRequest, ApprovalDecision } from "@agent-lens/protocol";

const RISK_STYLES: Record<string, string> = {
  low: "text-green-400 bg-green-500/10 border-green-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
};

interface ApprovalPanelProps {
  approvals: ApprovalRequest[];
  onDecision: (decision: ApprovalDecision) => void;
}

export function ApprovalPanel({ approvals, onDecision }: ApprovalPanelProps) {
  if (approvals.length === 0) return null;

  return (
    <div className="border-t border-[--border] bg-[--bg-secondary]">
      <div className="px-4 py-2 border-b border-[--border] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <span className="text-xs font-bold tracking-widest uppercase">
          Pending Approvals ({approvals.length})
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {approvals.map((approval) => (
          <ApprovalCard key={approval.requestId} approval={approval} onDecision={onDecision} />
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onDecision,
}: {
  approval: ApprovalRequest;
  onDecision: (decision: ApprovalDecision) => void;
}) {
  const [note, setNote] = useState("");
  const riskStyle = RISK_STYLES[approval.riskLevel] ?? RISK_STYLES.medium;

  const decide = (decision: "approved" | "rejected") => {
    onDecision({
      requestId: approval.requestId,
      decision,
      operatorNote: note || undefined,
      decidedAt: Date.now(),
      decidedBy: "operator",
    });
  };

  return (
    <div className="p-3 border-b border-[--border] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{approval.toolName}</span>
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${riskStyle}`}>
          {approval.riskLevel.toUpperCase()}
        </span>
      </div>

      <div className="text-xs text-[--text-secondary]">
        Server: {approval.mcpServer}
      </div>

      <div className="text-xs text-[--text-secondary]">{approval.reason}</div>

      <pre className="text-[10px] bg-[--bg-primary] p-2 rounded overflow-x-auto">
        {JSON.stringify(approval.arguments, null, 2)}
      </pre>

      <input
        type="text"
        placeholder="Note (optional)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-2 py-1 text-xs bg-[--bg-primary] border border-[--border] rounded focus:outline-none focus:border-blue-500"
      />

      <div className="flex gap-2">
        <button
          onClick={() => decide("approved")}
          className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-colors cursor-pointer"
        >
          APPROVE
        </button>
        <button
          onClick={() => decide("rejected")}
          className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
        >
          REJECT
        </button>
      </div>
    </div>
  );
}
