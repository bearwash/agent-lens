// ─── Agent Lens PostgreSQL Store ───
// Append-only PostgreSQL implementation of the Store interface.
// Uses connection pooling via `pg`, JSONB for attributes/events,
// and pgaudit-friendly parameterized queries throughout.

import pg from "pg";
import type {
  AgentSpan,
  AgentSession,
  Branch,
  ApprovalRequest,
  ApprovalDecision,
  SpanKind,
  SpanStatus,
  SpanAttributes,
  SpanEvent,
} from "@agent-lens/protocol";
import type { Store } from "./index.js";
import { runMigrations } from "./migrations.js";

const { Pool } = pg;

export interface PgStoreOptions {
  /** PostgreSQL connection string, e.g. "postgresql://user:pass@localhost:5432/agent_lens" */
  connectionString?: string;
  /** Maximum number of clients in the pool. Default: 20 */
  maxPoolSize?: number;
  /** Whether to run migrations on connect. Default: true */
  autoMigrate?: boolean;
  /** Additional pg.PoolConfig options */
  poolConfig?: pg.PoolConfig;
}

export class PgStore implements Store {
  private pool: pg.Pool;
  private readonly autoMigrate: boolean;
  private initialized = false;

  constructor(options: PgStoreOptions = {}) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: options.maxPoolSize ?? 20,
      ...options.poolConfig,
    });
    this.autoMigrate = options.autoMigrate ?? true;
  }

  /**
   * Initialize the store: run migrations if autoMigrate is enabled.
   * This is called lazily on first operation, or can be called explicitly.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.autoMigrate) {
      await runMigrations(this.pool);
    }
    this.initialized = true;
  }

  /** Ensure initialization has happened before any query. */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /** Gracefully shut down the connection pool. */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ─── Sessions ───

  async createSession(session: AgentSession): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `INSERT INTO agent_sessions (session_id, agent_system, started_at, status, root_branch_id, active_branch_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.sessionId,
        session.agentSystem,
        session.startedAt,
        session.status,
        session.rootBranchId,
        session.activeBranchId,
        session.metadata ? JSON.stringify(session.metadata) : null,
      ],
    );
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM agent_sessions WHERE session_id = $1",
      [sessionId],
    );
    if (result.rows.length === 0) return undefined;
    return rowToSession(result.rows[0]);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<AgentSession>,
  ): Promise<void> {
    await this.ensureInitialized();
    // Build SET clause dynamically from provided updates
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.agentSystem !== undefined) {
      setClauses.push(`agent_system = $${paramIndex++}`);
      values.push(updates.agentSystem);
    }
    if (updates.startedAt !== undefined) {
      setClauses.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.rootBranchId !== undefined) {
      setClauses.push(`root_branch_id = $${paramIndex++}`);
      values.push(updates.rootBranchId);
    }
    if (updates.activeBranchId !== undefined) {
      setClauses.push(`active_branch_id = $${paramIndex++}`);
      values.push(updates.activeBranchId);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = now()`);
    values.push(sessionId);

    await this.pool.query(
      `UPDATE agent_sessions SET ${setClauses.join(", ")} WHERE session_id = $${paramIndex}`,
      values,
    );
  }

  async listSessions(): Promise<AgentSession[]> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM agent_sessions ORDER BY started_at DESC",
    );
    return result.rows.map(rowToSession);
  }

  // ─── Spans (append-only) ───

  async appendSpan(span: AgentSpan): Promise<void> {
    await this.ensureInitialized();
    // Derive sessionId from attributes or trace lookup if needed
    const sessionId =
      (span.attributes["agent_lens.session_id"] as string | undefined) ?? null;

    await this.pool.query(
      `INSERT INTO agent_spans (span_id, trace_id, parent_span_id, session_id, name, kind, start_time, end_time, status, attributes, events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        span.spanId,
        span.traceId,
        span.parentSpanId ?? null,
        sessionId,
        span.name,
        span.kind,
        span.startTime,
        span.endTime ?? null,
        span.status,
        JSON.stringify(span.attributes),
        JSON.stringify(span.events),
      ],
    );
  }

  async getSpan(spanId: string): Promise<AgentSpan | undefined> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM agent_spans WHERE span_id = $1",
      [spanId],
    );
    if (result.rows.length === 0) return undefined;
    return rowToSpan(result.rows[0]);
  }

  async updateSpan(
    spanId: string,
    updates: Partial<AgentSpan>,
  ): Promise<void> {
    await this.ensureInitialized();
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.kind !== undefined) {
      setClauses.push(`kind = $${paramIndex++}`);
      values.push(updates.kind);
    }
    if (updates.startTime !== undefined) {
      setClauses.push(`start_time = $${paramIndex++}`);
      values.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      setClauses.push(`end_time = $${paramIndex++}`);
      values.push(updates.endTime);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.attributes !== undefined) {
      setClauses.push(`attributes = $${paramIndex++}`);
      values.push(JSON.stringify(updates.attributes));
    }
    if (updates.events !== undefined) {
      setClauses.push(`events = $${paramIndex++}`);
      values.push(JSON.stringify(updates.events));
    }
    if (updates.parentSpanId !== undefined) {
      setClauses.push(`parent_span_id = $${paramIndex++}`);
      values.push(updates.parentSpanId);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = now()`);
    values.push(spanId);

    await this.pool.query(
      `UPDATE agent_spans SET ${setClauses.join(", ")} WHERE span_id = $${paramIndex}`,
      values,
    );
  }

  async getSpansBySession(sessionId: string): Promise<AgentSpan[]> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM agent_spans WHERE session_id = $1 ORDER BY start_time ASC",
      [sessionId],
    );
    return result.rows.map(rowToSpan);
  }

  async getSpansByBranch(branchId: string): Promise<AgentSpan[]> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      `SELECT * FROM agent_spans WHERE attributes->>'agent_lens.branch_id' = $1 ORDER BY start_time ASC`,
      [branchId],
    );
    return result.rows.map(rowToSpan);
  }

  async getSpansByTrace(traceId: string): Promise<AgentSpan[]> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM agent_spans WHERE trace_id = $1 ORDER BY start_time ASC",
      [traceId],
    );
    return result.rows.map(rowToSpan);
  }

  // ─── Branches ───

  async createBranch(branch: Branch): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `INSERT INTO branches (branch_id, parent_branch_id, fork_point_span_id, created_at, label, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        branch.branchId,
        branch.parentBranchId ?? null,
        branch.forkPointSpanId ?? null,
        branch.createdAt,
        branch.label ?? null,
        branch.status,
      ],
    );
  }

  async getBranch(branchId: string): Promise<Branch | undefined> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM branches WHERE branch_id = $1",
      [branchId],
    );
    if (result.rows.length === 0) return undefined;
    return rowToBranch(result.rows[0]);
  }

  async updateBranch(
    branchId: string,
    updates: Partial<Branch>,
  ): Promise<void> {
    await this.ensureInitialized();
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.parentBranchId !== undefined) {
      setClauses.push(`parent_branch_id = $${paramIndex++}`);
      values.push(updates.parentBranchId);
    }
    if (updates.forkPointSpanId !== undefined) {
      setClauses.push(`fork_point_span_id = $${paramIndex++}`);
      values.push(updates.forkPointSpanId);
    }
    if (updates.label !== undefined) {
      setClauses.push(`label = $${paramIndex++}`);
      values.push(updates.label);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = now()`);
    values.push(branchId);

    await this.pool.query(
      `UPDATE branches SET ${setClauses.join(", ")} WHERE branch_id = $${paramIndex}`,
      values,
    );
  }

  async getBranchesBySession(sessionId: string): Promise<Branch[]> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM branches WHERE session_id = $1 ORDER BY created_at ASC",
      [sessionId],
    );
    return result.rows.map(rowToBranch);
  }

  // ─── Approval Gate ───

  async createApprovalRequest(request: ApprovalRequest): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `INSERT INTO approval_requests (request_id, session_id, span_id, mcp_server, tool_name, arguments, risk_level, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        request.requestId,
        request.sessionId,
        request.spanId,
        request.mcpServer,
        request.toolName,
        JSON.stringify(request.arguments),
        request.riskLevel,
        request.reason,
        request.createdAt,
      ],
    );
  }

  async getApprovalRequest(
    requestId: string,
  ): Promise<ApprovalRequest | undefined> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM approval_requests WHERE request_id = $1",
      [requestId],
    );
    if (result.rows.length === 0) return undefined;
    return rowToApprovalRequest(result.rows[0]);
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    await this.ensureInitialized();
    // Append-only: "pending" means no corresponding decision row exists
    const result = await this.pool.query(
      `SELECT ar.* FROM approval_requests ar
       LEFT JOIN approval_decisions ad ON ar.request_id = ad.request_id
       WHERE ad.request_id IS NULL
       ORDER BY ar.created_at ASC`,
    );
    return result.rows.map(rowToApprovalRequest);
  }

  async saveApprovalDecision(decision: ApprovalDecision): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `INSERT INTO approval_decisions (request_id, decision, modified_arguments, operator_note, decided_at, decided_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        decision.requestId,
        decision.decision,
        decision.modifiedArguments
          ? JSON.stringify(decision.modifiedArguments)
          : null,
        decision.operatorNote ?? null,
        decision.decidedAt,
        decision.decidedBy,
      ],
    );
  }

  async getApprovalDecision(
    requestId: string,
  ): Promise<ApprovalDecision | undefined> {
    await this.ensureInitialized();
    const result = await this.pool.query(
      "SELECT * FROM approval_decisions WHERE request_id = $1",
      [requestId],
    );
    if (result.rows.length === 0) return undefined;
    return rowToApprovalDecision(result.rows[0]);
  }
}

// ─── Row Mapping Helpers ───

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToSession(row: any): AgentSession {
  return {
    sessionId: row.session_id,
    agentSystem: row.agent_system,
    startedAt: Number(row.started_at),
    status: row.status,
    rootBranchId: row.root_branch_id,
    activeBranchId: row.active_branch_id,
    metadata: row.metadata ?? undefined,
  };
}

function rowToSpan(row: any): AgentSpan {
  return {
    traceId: row.trace_id,
    spanId: row.span_id,
    parentSpanId: row.parent_span_id ?? undefined,
    name: row.name,
    kind: row.kind as SpanKind,
    startTime: Number(row.start_time),
    endTime: row.end_time != null ? Number(row.end_time) : undefined,
    status: row.status as SpanStatus,
    attributes: (row.attributes ?? {}) as SpanAttributes,
    events: (row.events ?? []) as SpanEvent[],
  };
}

function rowToBranch(row: any): Branch {
  return {
    branchId: row.branch_id,
    parentBranchId: row.parent_branch_id ?? undefined,
    forkPointSpanId: row.fork_point_span_id ?? undefined,
    createdAt: Number(row.created_at),
    label: row.label ?? undefined,
    status: row.status,
  };
}

function rowToApprovalRequest(row: any): ApprovalRequest {
  return {
    requestId: row.request_id,
    sessionId: row.session_id,
    spanId: row.span_id,
    mcpServer: row.mcp_server,
    toolName: row.tool_name,
    arguments: row.arguments ?? {},
    riskLevel: row.risk_level,
    reason: row.reason,
    createdAt: Number(row.created_at),
  };
}

function rowToApprovalDecision(row: any): ApprovalDecision {
  return {
    requestId: row.request_id,
    decision: row.decision,
    modifiedArguments: row.modified_arguments ?? undefined,
    operatorNote: row.operator_note ?? undefined,
    decidedAt: Number(row.decided_at),
    decidedBy: row.decided_by,
  };
}
