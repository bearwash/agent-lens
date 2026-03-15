// ─── Agent Lens Store ───
// Append-only storage abstraction for spans, sessions, and branches.
// MVP: In-memory store. PostgreSQL adapter added in Phase 2.

import type {
  AgentSpan,
  AgentSession,
  Branch,
  ApprovalRequest,
  ApprovalDecision,
} from "@agent-lens/protocol";

export interface Store {
  // Sessions
  createSession(session: AgentSession): Promise<void>;
  getSession(sessionId: string): Promise<AgentSession | undefined>;
  updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<void>;
  listSessions(): Promise<AgentSession[]>;

  // Spans (append-only — no delete)
  appendSpan(span: AgentSpan): Promise<void>;
  getSpan(spanId: string): Promise<AgentSpan | undefined>;
  updateSpan(spanId: string, updates: Partial<AgentSpan>): Promise<void>;
  getSpansBySession(sessionId: string): Promise<AgentSpan[]>;
  getSpansByBranch(branchId: string): Promise<AgentSpan[]>;
  getSpansByTrace(traceId: string): Promise<AgentSpan[]>;

  // Branches
  createBranch(branch: Branch): Promise<void>;
  getBranch(branchId: string): Promise<Branch | undefined>;
  updateBranch(branchId: string, updates: Partial<Branch>): Promise<void>;
  getBranchesBySession(sessionId: string): Promise<Branch[]>;

  // Approval Gate
  createApprovalRequest(request: ApprovalRequest): Promise<void>;
  getApprovalRequest(requestId: string): Promise<ApprovalRequest | undefined>;
  getPendingApprovals(): Promise<ApprovalRequest[]>;
  saveApprovalDecision(decision: ApprovalDecision): Promise<void>;
  getApprovalDecision(requestId: string): Promise<ApprovalDecision | undefined>;
}

// ─── In-Memory Store (MVP) ───

export { PgStore } from "./pg-store.js";
export type { PgStoreOptions } from "./pg-store.js";
export { runMigrations } from "./migrations.js";
export { AuditTrail } from "./audit-trail.js";

export class MemoryStore implements Store {
  private sessions = new Map<string, AgentSession>();
  private spans = new Map<string, AgentSpan>();
  private branches = new Map<string, Branch>();
  private approvalRequests = new Map<string, ApprovalRequest>();
  private approvalDecisions = new Map<string, ApprovalDecision>();

  // Track relationships
  private sessionSpans = new Map<string, Set<string>>();
  private branchSpans = new Map<string, Set<string>>();
  private traceSpans = new Map<string, Set<string>>();
  private sessionBranches = new Map<string, Set<string>>();

  async createSession(session: AgentSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
    this.sessionSpans.set(session.sessionId, new Set());
    this.sessionBranches.set(session.sessionId, new Set());
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, { ...session, ...updates });
    }
  }

  async listSessions(): Promise<AgentSession[]> {
    return [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  async appendSpan(span: AgentSpan): Promise<void> {
    this.spans.set(span.spanId, span);

    // Index by trace
    const traceSet = this.traceSpans.get(span.traceId) ?? new Set();
    traceSet.add(span.spanId);
    this.traceSpans.set(span.traceId, traceSet);

    // Index by branch
    const branchId = span.attributes["agent_lens.branch_id"] as string | undefined;
    if (branchId) {
      const branchSet = this.branchSpans.get(branchId) ?? new Set();
      branchSet.add(span.spanId);
      this.branchSpans.set(branchId, branchSet);
    }
  }

  async getSpan(spanId: string): Promise<AgentSpan | undefined> {
    return this.spans.get(spanId);
  }

  async updateSpan(spanId: string, updates: Partial<AgentSpan>): Promise<void> {
    const span = this.spans.get(spanId);
    if (span) {
      this.spans.set(spanId, { ...span, ...updates });
    }
  }

  async getSpansBySession(sessionId: string): Promise<AgentSpan[]> {
    const spanIds = this.sessionSpans.get(sessionId);
    if (!spanIds) return [];
    return [...spanIds].map((id) => this.spans.get(id)!).filter(Boolean);
  }

  async getSpansByBranch(branchId: string): Promise<AgentSpan[]> {
    const spanIds = this.branchSpans.get(branchId);
    if (!spanIds) return [];
    return [...spanIds]
      .map((id) => this.spans.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.startTime - b.startTime);
  }

  async getSpansByTrace(traceId: string): Promise<AgentSpan[]> {
    const spanIds = this.traceSpans.get(traceId);
    if (!spanIds) return [];
    return [...spanIds]
      .map((id) => this.spans.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.startTime - b.startTime);
  }

  async createBranch(branch: Branch): Promise<void> {
    this.branches.set(branch.branchId, branch);
  }

  async getBranch(branchId: string): Promise<Branch | undefined> {
    return this.branches.get(branchId);
  }

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<void> {
    const branch = this.branches.get(branchId);
    if (branch) {
      this.branches.set(branchId, { ...branch, ...updates });
    }
  }

  async getBranchesBySession(sessionId: string): Promise<Branch[]> {
    const branchIds = this.sessionBranches.get(sessionId);
    if (!branchIds) return [];
    return [...branchIds]
      .map((id) => this.branches.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async createApprovalRequest(request: ApprovalRequest): Promise<void> {
    this.approvalRequests.set(request.requestId, request);
  }

  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | undefined> {
    return this.approvalRequests.get(requestId);
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    return [...this.approvalRequests.values()].filter(
      (req) => !this.approvalDecisions.has(req.requestId),
    );
  }

  async saveApprovalDecision(decision: ApprovalDecision): Promise<void> {
    this.approvalDecisions.set(decision.requestId, decision);
  }

  async getApprovalDecision(requestId: string): Promise<ApprovalDecision | undefined> {
    return this.approvalDecisions.get(requestId);
  }
}
