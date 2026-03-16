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
      <div className="h-12 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[--accent-blue] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
                <circle cx="6" cy="6" r="1.5" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold">Agent Lens</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {pendingApprovals > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingApprovals} pending
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-[--text-secondary]">
            <span>{sessionCount} {sessionCount === 1 ? "session" : "sessions"}</span>
            <span className="text-[--border]">|</span>
            <span>{spanCount} {spanCount === 1 ? "span" : "spans"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
            <span className="text-xs text-[--text-secondary]">
              {connected ? "Connected" : "Reconnecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Cost bar */}
      <div className="px-5 pb-2">
        <CostDisplay spans={spans} />
      </div>
    </header>
  );
}
