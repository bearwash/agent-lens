"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  AgentSpan,
  AgentSession,
  Branch,
  ApprovalRequest,
  DashboardEvent,
} from "@agent-lens/protocol";

const DEFAULT_WS_URL = "ws://localhost:18790";

export interface AgentState {
  connected: boolean;
  sessions: AgentSession[];
  spans: Map<string, AgentSpan>;
  branches: Map<string, Branch>;
  pendingApprovals: ApprovalRequest[];
  spanTimeline: AgentSpan[]; // Sorted by startTime
}

export function useAgentStream(wsUrl: string = DEFAULT_WS_URL) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<AgentState>({
    connected: false,
    sessions: [],
    spans: new Map(),
    branches: new Map(),
    pendingApprovals: [],
    spanTimeline: [],
  });

  const submitApproval = useCallback(
    (decision: DashboardEvent & { type: "approval:decision" }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(decision));
      }
    },
    [],
  );

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let retryCount = 0;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount = 0;
        setState((s) => ({ ...s, connected: true }));
      };

      ws.onclose = () => {
        setState((s) => ({ ...s, connected: false }));
        // Exponential backoff: 1s, 2s, 4s, max 10s
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        retryCount++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // Silently handled by onclose — no console spam
      };

      ws.onmessage = (event) => {
        try {
          const dashEvent = JSON.parse(event.data) as DashboardEvent;
          setState((prev) => applyEvent(prev, dashEvent));
        } catch {
          // Ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [wsUrl]);

  const sendMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    [],
  );

  return { state, submitApproval, sendMessage };
}

function applyEvent(state: AgentState, event: DashboardEvent): AgentState {
  const next = { ...state };

  switch (event.type) {
    case "span:start": {
      const spans = new Map(state.spans);
      spans.set(event.span.spanId, event.span);
      next.spans = spans;
      next.spanTimeline = [...spans.values()].sort(
        (a, b) => a.startTime - b.startTime,
      );
      break;
    }

    case "span:update": {
      const spans = new Map(state.spans);
      const existing = spans.get(event.spanId);
      if (existing) {
        spans.set(event.spanId, { ...existing, ...event.updates });
        next.spans = spans;
        next.spanTimeline = [...spans.values()].sort(
          (a, b) => a.startTime - b.startTime,
        );
      }
      break;
    }

    case "span:end": {
      const spans = new Map(state.spans);
      const existing = spans.get(event.spanId);
      if (existing) {
        spans.set(event.spanId, {
          ...existing,
          endTime: event.endTime,
          status: event.status,
        });
        next.spans = spans;
        next.spanTimeline = [...spans.values()].sort(
          (a, b) => a.startTime - b.startTime,
        );
      }
      break;
    }

    case "session:start":
      next.sessions = [...state.sessions, event.session];
      break;

    case "session:update": {
      next.sessions = state.sessions.map((s) =>
        s.sessionId === event.sessionId ? { ...s, ...event.updates } : s,
      );
      break;
    }

    case "branch:create": {
      const branches = new Map(state.branches);
      branches.set(event.branch.branchId, event.branch);
      next.branches = branches;
      break;
    }

    case "branch:update": {
      const branches = new Map(state.branches);
      const existing = branches.get(event.branchId);
      if (existing) {
        branches.set(event.branchId, { ...existing, ...event.updates });
        next.branches = branches;
      }
      break;
    }

    case "approval:request":
      next.pendingApprovals = [...state.pendingApprovals, event.approval];
      break;

    case "approval:decision":
      next.pendingApprovals = state.pendingApprovals.filter(
        (a) => a.requestId !== event.decision.requestId,
      );
      break;
  }

  return next;
}
