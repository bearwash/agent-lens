"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import { CostDisplay } from "./cost-display";

interface HeaderProps {
  connected: boolean;
  sessionCount: number;
  spanCount: number;
  pendingApprovals: number;
  spans: Map<string, AgentSpan>;
}

export function Header({ connected, sessionCount, spanCount, pendingApprovals, spans }: HeaderProps) {
  return (
    <header className="border-b border-[--border] bg-[--bg-secondary]">
      <div className="h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider">
            <span className="text-[--accent-blue]">[</span>
            AGENT LENS
            <span className="text-[--accent-blue]">]</span>
          </span>
          <span className="text-[10px] text-[--text-secondary]">v0.2.0</span>
        </div>

        <div className="flex items-center gap-4">
          {pendingApprovals > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-300 text-[10px] font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {pendingApprovals} PENDING
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-[--text-secondary]">
            <span>{sessionCount} sessions</span>
            <span>{spanCount} spans</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
            <span className="text-[10px] text-[--text-secondary]">
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
        </div>
      </div>

      {/* Cost accumulation bar */}
      <div className="px-4 pb-2">
        <CostDisplay spans={spans} />
      </div>
    </header>
  );
}
