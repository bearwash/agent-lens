// ─── Agent Lens PostgreSQL Migrations ───
// Schema migration runner with version tracking.

import type { Pool } from "pg";

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "create_schema_version",
    up: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version   INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: 2,
    name: "create_agent_sessions",
    up: `
      CREATE TABLE agent_sessions (
        session_id       TEXT PRIMARY KEY,
        agent_system     TEXT NOT NULL,
        started_at       BIGINT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'running',
        root_branch_id   TEXT NOT NULL,
        active_branch_id TEXT NOT NULL,
        metadata         JSONB,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_sessions_status ON agent_sessions (status);
      CREATE INDEX idx_sessions_started_at ON agent_sessions (started_at DESC);
    `,
  },
  {
    version: 3,
    name: "create_agent_spans",
    up: `
      CREATE TABLE agent_spans (
        span_id        TEXT PRIMARY KEY,
        trace_id       TEXT NOT NULL,
        parent_span_id TEXT,
        session_id     TEXT,
        name           TEXT NOT NULL,
        kind           TEXT NOT NULL,
        start_time     BIGINT NOT NULL,
        end_time       BIGINT,
        status         TEXT NOT NULL DEFAULT 'pending',
        attributes     JSONB NOT NULL DEFAULT '{}',
        events         JSONB NOT NULL DEFAULT '[]',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_spans_trace_id ON agent_spans (trace_id);
      CREATE INDEX idx_spans_session_id ON agent_spans (session_id);
      CREATE INDEX idx_spans_parent_span_id ON agent_spans (parent_span_id);
      CREATE INDEX idx_spans_start_time ON agent_spans (start_time);
      CREATE INDEX idx_spans_branch_id ON agent_spans ((attributes->>'agent_lens.branch_id'));
      CREATE INDEX idx_spans_kind ON agent_spans (kind);
      CREATE INDEX idx_spans_status ON agent_spans (status);
    `,
  },
  {
    version: 4,
    name: "create_branches",
    up: `
      CREATE TABLE branches (
        branch_id          TEXT PRIMARY KEY,
        session_id         TEXT,
        parent_branch_id   TEXT,
        fork_point_span_id TEXT,
        created_at         BIGINT NOT NULL,
        label              TEXT,
        status             TEXT NOT NULL DEFAULT 'active',
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_branches_session_id ON branches (session_id);
      CREATE INDEX idx_branches_parent_branch_id ON branches (parent_branch_id);
      CREATE INDEX idx_branches_status ON branches (status);
    `,
  },
  {
    version: 5,
    name: "create_approval_requests",
    up: `
      CREATE TABLE approval_requests (
        request_id  TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        span_id     TEXT NOT NULL,
        mcp_server  TEXT NOT NULL,
        tool_name   TEXT NOT NULL,
        arguments   JSONB NOT NULL DEFAULT '{}',
        risk_level  TEXT NOT NULL,
        reason      TEXT NOT NULL,
        created_at  BIGINT NOT NULL
      );

      CREATE INDEX idx_approval_requests_session_id ON approval_requests (session_id);
      CREATE INDEX idx_approval_requests_span_id ON approval_requests (span_id);
      CREATE INDEX idx_approval_requests_risk_level ON approval_requests (risk_level);
    `,
  },
  {
    version: 6,
    name: "create_approval_decisions",
    up: `
      CREATE TABLE approval_decisions (
        request_id          TEXT PRIMARY KEY,
        decision            TEXT NOT NULL,
        modified_arguments  JSONB,
        operator_note       TEXT,
        decided_at          BIGINT NOT NULL,
        decided_by          TEXT NOT NULL
      );

      CREATE INDEX idx_approval_decisions_decision ON approval_decisions (decision);
    `,
  },
];

/**
 * Returns the current schema version from the database.
 * Returns 0 if the schema_version table does not exist yet.
 */
async function getCurrentVersion(pool: Pool): Promise<number> {
  const client = await pool.connect();
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_version'
      ) AS exists;
    `);

    if (!tableCheck.rows[0].exists) {
      return 0;
    }

    const result = await client.query(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_version",
    );
    return result.rows[0].version as number;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations up to the latest version.
 * Each migration runs in its own transaction.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const currentVersion = await getCurrentVersion(pool);

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    return;
  }

  for (const migration of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.up);
      await client.query(
        "INSERT INTO schema_version (version, name) VALUES ($1, $2)",
        [migration.version, migration.name],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }
}

export { migrations };
