"use client";

import { useState, useCallback } from "react";
import type { AgentSpan } from "@agent-lens/protocol";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Header } from "@/components/header";
import { Timeline } from "@/components/timeline";
import { SpanDetail } from "@/components/span-detail";
import { ApprovalPanel } from "@/components/approval-panel";
import { BranchTree } from "@/components/branch-tree";
import { SpanContextMenu } from "@/components/span-context-menu";

interface ContextMenuState {
  span: AgentSpan;
  position: { x: number; y: number };
}

export default function DashboardPage() {
  const { state, submitApproval, sendMessage } = useAgentStream();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [activeBranchFilter, setActiveBranchFilter] = useState<string>("main");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const selectedSpan = selectedSpanId ? state.spans.get(selectedSpanId) ?? null : null;

  // Filter spans by selected branch (show all if "main")
  const filteredSpans = activeBranchFilter === "main"
    ? state.spanTimeline
    : state.spanTimeline.filter((s) => {
        const branchId = (s.attributes["agent_lens.branch_id"] as string) ?? "main";
        return branchId === activeBranchFilter || branchId === "main";
      });

  const handleFork = useCallback(
    (spanId: string, label: string) => {
      const sessions = state.sessions;
      const sessionId = sessions.length > 0 ? sessions[sessions.length - 1].sessionId : null;
      if (!sessionId) return;

      sendMessage({
        type: "branch:create",
        sessionId,
        forkPointSpanId: spanId,
        label,
      });
    },
    [state.sessions, sendMessage],
  );

  const handleRewind = useCallback(
    (spanId: string) => {
      // Rewind: select the span and highlight it, preparing for re-execution
      setSelectedSpanId(spanId);
    },
    [],
  );

  return (
    <div className="h-screen flex flex-col">
      <Header
        connected={state.connected}
        sessionCount={state.sessions.length}
        spanCount={state.spans.size}
        pendingApprovals={state.pendingApprovals.length}
        spans={state.spans}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: Branch tree + Timeline */}
        <div className="w-80 border-r border-[--border] bg-[--bg-secondary] flex flex-col">
          {/* Branch tree (collapsible) */}
          {state.branches.size > 0 && (
            <div className="border-b border-[--border]">
              <BranchTree
                branches={state.branches}
                activeBranchId={activeBranchFilter}
                onSelectBranch={setActiveBranchFilter}
              />
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-hidden">
            <Timeline
              spans={filteredSpans}
              selectedSpanId={selectedSpanId}
              onSelectSpan={setSelectedSpanId}
              onSpanContextMenu={(span, position) => setContextMenu({ span, position })}
            />
          </div>

          {/* Approval panel */}
          <ApprovalPanel
            approvals={state.pendingApprovals}
            onDecision={(decision) => {
              submitApproval({ type: "approval:decision", decision });
            }}
          />
        </div>

        {/* Right: Detail view */}
        <div className="flex-1 bg-[--bg-primary]">
          <SpanDetail span={selectedSpan} />
        </div>
      </div>

      {/* Context menu overlay */}
      {contextMenu && (
        <SpanContextMenu
          span={contextMenu.span}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onFork={handleFork}
          onRewind={handleRewind}
        />
      )}
    </div>
  );
}
