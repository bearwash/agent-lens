"use client";

import { useState } from "react";
import type { ApprovalRequest, ApprovalDecision } from "@agent-lens/protocol";
import type { TranslationKey } from "@/lib/i18n";

const RISK_STYLES: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10",
  medium: "text-amber-400 bg-amber-500/10",
  high: "text-orange-400 bg-orange-500/10",
  critical: "text-red-400 bg-red-500/10",
};

interface ApprovalPanelProps {
  approvals: ApprovalRequest[];
  onDecision: (decision: ApprovalDecision) => void;
  t: (key: TranslationKey) => string;
}

export function ApprovalPanel({ approvals, onDecision, t }: ApprovalPanelProps) {
  if (approvals.length === 0) return null;

  return (
    <div className="border-t border-[--border] bg-[--bg-secondary]">
      <div className="px-4 py-2.5 border-b border-[--border] flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-[--text-secondary]">
          {approvals.length}{t(approvals.length === 1 ? "approval.pendingApproval" : "approval.pendingApprovals")}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {approvals.map((approval) => (
          <ApprovalCard key={approval.requestId} approval={approval} onDecision={onDecision} t={t} />
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({ approval, onDecision, t }: { approval: ApprovalRequest; onDecision: (d: ApprovalDecision) => void; t: (key: TranslationKey) => string }) {
  const [note, setNote] = useState("");
  const riskStyle = RISK_STYLES[approval.riskLevel] ?? RISK_STYLES.medium;

  const decide = (decision: "approved" | "rejected") => {
    onDecision({ requestId: approval.requestId, decision, operatorNote: note || undefined, decidedAt: Date.now(), decidedBy: "operator" });
  };

  return (
    <div className="p-3.5 border-b border-[--border] space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{approval.toolName}</span>
        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${riskStyle}`}>{approval.riskLevel}</span>
      </div>
      <div className="text-xs text-[--text-tertiary]">{approval.mcpServer}</div>
      <div className="text-xs text-[--text-secondary]">{approval.reason}</div>
      <pre className="text-[11px] font-mono bg-[--bg-tertiary] p-2.5 rounded-lg overflow-x-auto text-[--text-secondary]">{JSON.stringify(approval.arguments, null, 2)}</pre>
      <input type="text" placeholder={t("approval.addNote")} value={note} onChange={(e) => setNote(e.target.value)}
        className="w-full px-3 py-1.5 text-xs bg-[--bg-tertiary] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent-blue] placeholder:text-[--text-tertiary]" />
      <div className="flex gap-2">
        <button onClick={() => decide("approved")} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer">{t("approval.approve")}</button>
        <button onClick={() => decide("rejected")} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer">{t("approval.reject")}</button>
      </div>
    </div>
  );
}
