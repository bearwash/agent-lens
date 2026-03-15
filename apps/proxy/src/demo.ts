// ─── Agent Lens Demo Scenario ───
// Generates realistic fake agent activity for showcasing the dashboard.
// Simulates an OpenClaw agent debugging a broken API endpoint.

import type {
  AgentSpan,
  AgentSession,
  Branch,
  DashboardEvent,
  ApprovalRequest,
  ApprovalDecision,
  Attachment,
} from "@agent-lens/protocol";
import { randomUUID } from "node:crypto";

// ─── Helpers ───

function spanId(): string {
  return randomUUID().slice(0, 16).replace(/-/g, "");
}

function uuid(): string {
  return randomUUID();
}

// Claude Opus pricing: $15/1M input, $75/1M output
function cost(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1_000_000) * 15;
  const outputCost = (outputTokens / 1_000_000) * 75;
  return {
    "gen_ai.usage.input_tokens": inputTokens,
    "gen_ai.usage.output_tokens": outputTokens,
    "gen_ai.usage.total_tokens": inputTokens + outputTokens,
    "agent_lens.cost.input_usd": Math.round(inputCost * 1_000_000) / 1_000_000,
    "agent_lens.cost.output_usd": Math.round(outputCost * 1_000_000) / 1_000_000,
    "agent_lens.cost.total_usd": Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
  };
}

// Tiny 1x1 red PNG as base64 placeholder for screenshot attachment
const PLACEHOLDER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BKwMgwKkAXAQBz9AoL/dmMJAAAAABJRU5ErkJggg==";

// ─── Event Emitter Interface ───

export type EmitFn = (event: DashboardEvent) => void;

// ─── Scenario Runner ───

export async function runDemoScenario(emit: EmitFn): Promise<void> {
  const traceId = randomUUID().replace(/-/g, "").slice(0, 32);
  const sessionId = uuid();
  const mainBranchId = "main";
  const fixBranchId = "fix-correct";
  let now = Date.now();

  function ts(offsetMs: number = 0): number {
    return now + offsetMs;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Helper: emit span start, wait, then emit span end
  async function emitSpan(
    span: AgentSpan,
    durationMs: number,
    displayDurationMs: number,
    endStatus: AgentSpan["status"] = "ok",
  ): Promise<void> {
    emit({ type: "span:start", span });
    await delay(displayDurationMs);
    emit({
      type: "span:end",
      spanId: span.spanId,
      endTime: span.startTime + durationMs,
      status: endStatus,
    });
  }

  // ─── Pre-generated IDs for cross-references ───
  const ids = {
    thinking1: spanId(),
    readFile1: spanId(),
    grepSearch1: spanId(),
    thinking2: spanId(),
    readFile2: spanId(),
    readFile3: spanId(),
    thinking3: spanId(),
    shellExec1: spanId(), // approval gate!
    thinking4: spanId(),
    editFileWrong: spanId(), // mistake at step 8
    thinking5: spanId(),
    branchSpan: spanId(),
    thinking6: spanId(),
    readFile4: spanId(),
    editFileCorrect: spanId(),
    shellExec2: spanId(),
    thinking7: spanId(),
    screenshotSpan: spanId(),
  };

  console.log("[Demo] Starting scenario: Find and fix broken API endpoint");
  console.log("[Demo] Session:", sessionId);
  console.log("[Demo] Trace:", traceId);

  // ═══ SESSION START ═══
  const session: AgentSession = {
    sessionId,
    agentSystem: "openclaw",
    startedAt: ts(),
    status: "running",
    rootBranchId: mainBranchId,
    activeBranchId: mainBranchId,
    metadata: {
      task: "Find and fix the broken API endpoint in the user service",
      model: "claude-opus-4-6",
    },
  };
  emit({ type: "session:start", session });

  // ═══ BRANCH: main ═══
  const mainBranch: Branch = {
    branchId: mainBranchId,
    createdAt: ts(),
    label: "Main execution",
    status: "active",
  };
  emit({ type: "branch:create", branch: mainBranch });

  await delay(300);

  // ═══ SPAN 1: Initial Thinking ═══
  console.log("[Demo] [1/17] Thinking: analyzing the task...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking1,
      name: "Analyzing task requirements",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "gen_ai.task": "Find and fix the broken API endpoint in the user service",
        "agent_lens.reasoning": `The user wants me to find and fix a broken API endpoint in the user service. Let me break this down:

1. First, I need to understand the project structure and find the user service code
2. I should look for API route definitions, particularly any that might be returning errors
3. Common causes of broken endpoints: incorrect route paths, missing middleware, database connection issues, malformed response objects, unhandled exceptions

Let me start by reading the project structure and then searching for error patterns in the user service.`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(1240, 387),
      },
      events: [],
    },
    2100,
    1500,
  );

  now += 2200;

  // ═══ SPAN 2: Read project structure ═══
  console.log("[Demo] [2/17] Tool: read_file (project structure)");
  await emitSpan(
    {
      traceId,
      spanId: ids.readFile1,
      parentSpanId: ids.thinking1,
      name: "read_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "read_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "read_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/",
          recursive: true,
        }),
        "gen_ai.completion": `Directory listing for src/services/user-service/:
├── index.ts
├── routes/
│   ├── auth.ts
│   ├── profile.ts
│   └── users.ts
├── middleware/
│   ├── auth-guard.ts
│   └── rate-limiter.ts
├── models/
│   ├── user.model.ts
│   └── session.model.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── profile.controller.ts
│   └── users.controller.ts
└── utils/
    ├── validators.ts
    └── password.ts`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(820, 195),
      },
      events: [],
    },
    890,
    800,
  );

  now += 1000;

  // ═══ SPAN 3: Grep for errors ═══
  console.log("[Demo] [3/17] Tool: grep_search (error patterns)");
  await emitSpan(
    {
      traceId,
      spanId: ids.grepSearch1,
      parentSpanId: ids.thinking1,
      name: "grep_search",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "grep_search",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "grep_search",
        "agent_lens.mcp.arguments": JSON.stringify({
          pattern: "500|Internal Server Error|throw new|catch\\s*\\(",
          path: "src/services/user-service/",
          include: "*.ts",
        }),
        "gen_ai.completion": `Found 7 matches across 3 files:

src/services/user-service/controllers/users.controller.ts:47:    } catch (error) {
src/services/user-service/controllers/users.controller.ts:48:      res.status(500).json({ error: "Internal Server Error" });
src/services/user-service/controllers/profile.controller.ts:23:    } catch (error) {
src/services/user-service/controllers/profile.controller.ts:24:      throw new HttpException(500, error.message);
src/services/user-service/routes/users.ts:31:  // FIXME: this endpoint returns 500 intermittently
src/services/user-service/routes/users.ts:32:  router.get("/api/v2/users/:id", usersController.getUserById);
src/services/user-service/routes/users.ts:58:    } catch (err) {`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(950, 280),
      },
      events: [],
    },
    1200,
    1000,
  );

  now += 1300;

  // ═══ SPAN 4: Thinking about grep results ═══
  console.log("[Demo] [4/17] Thinking: analyzing grep results...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking2,
      parentSpanId: ids.thinking1,
      name: "Analyzing search results",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "agent_lens.reasoning": `Interesting findings from the grep search:

1. There's a FIXME comment at users.ts:31 saying "this endpoint returns 500 intermittently" — this is a strong lead
2. The route \`/api/v2/users/:id\` is mapped to \`usersController.getUserById\`
3. The controller has a generic catch that returns 500

I need to look at:
- The \`getUserById\` method in users.controller.ts to understand what's failing
- The route definition to check middleware chain
- The user model to verify database query correctness

Let me read the controller file first since that's where the actual logic lives.`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(2180, 410),
      },
      events: [],
    },
    1800,
    1200,
  );

  now += 1900;

  // ═══ SPAN 5: Read controller ═══
  console.log("[Demo] [5/17] Tool: read_file (users.controller.ts)");
  await emitSpan(
    {
      traceId,
      spanId: ids.readFile2,
      parentSpanId: ids.thinking2,
      name: "read_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "read_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "read_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/controllers/users.controller.ts",
        }),
        "gen_ai.completion": `import { Request, Response } from "express";
import { UserModel } from "../models/user.model";
import { validateUUID } from "../utils/validators";

export class UsersController {
  async getUsers(req: Request, res: Response) {
    const users = await UserModel.findAll();
    res.json({ users, count: users.length });
  }

  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // BUG: validateUUID throws on invalid format but
      // we're not awaiting the async validation
      const isValid = validateUUID(id);

      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // BUG: accessing user.profile without null check
      // profile is loaded lazily and may be undefined
      const response = {
        id: user.id,
        email: user.email,
        name: user.profile.displayName,  // <-- crashes here
        avatar: user.profile.avatarUrl,
        createdAt: user.createdAt,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(1560, 320),
      },
      events: [],
    },
    950,
    900,
  );

  now += 1100;

  // ═══ SPAN 6: Read model ═══
  console.log("[Demo] [6/17] Tool: read_file (user.model.ts)");
  await emitSpan(
    {
      traceId,
      spanId: ids.readFile3,
      parentSpanId: ids.thinking2,
      name: "read_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "read_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "read_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/models/user.model.ts",
        }),
        "gen_ai.completion": `import { db } from "../../database";

interface UserProfile {
  displayName: string;
  avatarUrl: string | null;
  bio: string;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  profile?: UserProfile;  // <-- optional! lazy-loaded
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  static async findAll(): Promise<User[]> {
    return db.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 100");
  }

  static async findById(id: string): Promise<User | null> {
    const [user] = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    // Note: profile is NOT joined here — needs separate query
    return user ?? null;
  }

  static async findByIdWithProfile(id: string): Promise<User | null> {
    const [user] = await db.query(\`
      SELECT u.*, p.display_name, p.avatar_url, p.bio
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1
    \`, [id]);
    return user ?? null;
  }
}`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(1340, 295),
      },
      events: [],
    },
    780,
    700,
  );

  now += 900;

  // ═══ SPAN 7: Thinking — root cause identified ═══
  console.log("[Demo] [7/17] Thinking: root cause analysis...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking3,
      parentSpanId: ids.thinking2,
      name: "Root cause analysis",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "gen_ai.response.finish_reason": "stop",
        "agent_lens.reasoning": `Found the root cause! There are actually TWO bugs:

**Bug 1 (Primary):** In \`getUserById\`, the controller calls \`UserModel.findById()\` which does NOT join the profile table. The \`profile\` field is \`undefined\`. Then line 28 accesses \`user.profile.displayName\` which throws \`TypeError: Cannot read properties of undefined (reading 'displayName')\`.

**Bug 2 (Secondary):** The \`validateUUID\` call result isn't being used — if an invalid UUID is passed, it still proceeds to query the database.

**Fix:**
1. Change \`findById\` to \`findByIdWithProfile\` to get the profile data in a single query
2. Add optional chaining as a safety net: \`user.profile?.displayName\`
3. Add proper UUID validation with early return

Let me also run the failing test to confirm before fixing. I need to run \`npm test -- --grep "getUserById"\` to see the actual error.`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(3420, 580),
      },
      events: [],
    },
    2500,
    1800,
  );

  now += 2600;

  // ═══ SPAN 8: shell_execute — APPROVAL GATE ═══
  console.log("[Demo] [8/17] Tool: shell_execute (approval gate!)");

  const shellSpan: AgentSpan = {
    traceId,
    spanId: ids.shellExec1,
    parentSpanId: ids.thinking3,
    name: "shell_execute",
    kind: "tool_call",
    startTime: ts(),
    status: "paused",
    attributes: {
      "gen_ai.system": "openclaw",
      "gen_ai.request.model": "claude-opus-4-6",
      "gen_ai.action": "shell_execute",
      "agent_lens.mcp.server": "shell",
      "agent_lens.mcp.tool": "shell_execute",
      "agent_lens.mcp.arguments": JSON.stringify({
        command: "npm test -- --grep 'getUserById' --reporter spec",
        cwd: "src/services/user-service",
        timeout: 30000,
      }),
      "agent_lens.approval_required": true,
      "agent_lens.approval_status": "pending",
      "agent_lens.branch_id": mainBranchId,
      ...cost(410, 85),
    },
    events: [],
  };
  emit({ type: "span:start", span: shellSpan });

  // Approval request
  const approvalReq: ApprovalRequest = {
    requestId: uuid(),
    sessionId,
    spanId: ids.shellExec1,
    mcpServer: "shell",
    toolName: "shell_execute",
    arguments: {
      command: "npm test -- --grep 'getUserById' --reporter spec",
      cwd: "src/services/user-service",
      timeout: 30000,
    },
    riskLevel: "high",
    reason: "Shell command execution requires operator approval",
    createdAt: ts(),
  };
  emit({ type: "approval:request", approval: approvalReq });

  await delay(2500); // Pause for dramatic effect — operator reviewing

  // Auto-approve
  const approvalDec: ApprovalDecision = {
    requestId: approvalReq.requestId,
    decision: "approved",
    operatorNote: "Test command is safe to run",
    decidedAt: ts(2400),
    decidedBy: "operator@acme.dev",
  };
  emit({ type: "approval:decision", decision: approvalDec });

  emit({
    type: "span:update",
    spanId: ids.shellExec1,
    updates: {
      status: "pending",
      attributes: {
        ...shellSpan.attributes,
        "agent_lens.approval_status": "approved",
      },
    },
  });

  await delay(1500); // Test runs

  emit({
    type: "span:end",
    spanId: ids.shellExec1,
    endTime: ts(4200),
    status: "ok",
  });

  now += 4500;

  // ═══ SPAN 9: Thinking — plan fix ═══
  console.log("[Demo] [9/17] Thinking: planning the fix...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking4,
      parentSpanId: ids.thinking3,
      name: "Planning code fix",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "agent_lens.reasoning": `Test confirmed the failure:

\`\`\`
  UsersController
    getUserById
      ✓ should return user by valid ID (45ms)
      ✗ should handle user without profile
          TypeError: Cannot read properties of undefined (reading 'displayName')
            at UsersController.getUserById (controllers/users.controller.ts:28:32)
      ✓ should return 404 for nonexistent user
      ✗ should reject invalid UUID format
          AssertionError: expected 500 to equal 400
\`\`\`

2 of 4 tests failing, confirming both bugs. Now I need to edit the controller file. I'll fix:
1. Use \`findByIdWithProfile\` instead of \`findById\`
2. Add optional chaining for safety
3. Add UUID validation with 400 response`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(2890, 465),
      },
      events: [],
    },
    1600,
    1200,
  );

  now += 1700;

  // ═══ SPAN 10: edit_file — MISTAKE (wrong fix) ═══
  console.log("[Demo] [10/17] Tool: edit_file (WRONG fix — mistake!)");
  await emitSpan(
    {
      traceId,
      spanId: ids.editFileWrong,
      parentSpanId: ids.thinking4,
      name: "edit_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "edit_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "edit_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/models/user.model.ts",
          old_string: "static async findById(id: string): Promise<User | null> {",
          new_string: "static async findById(id: string): Promise<User | null> {\n    // FIXED: join profile eagerly",
        }),
        "gen_ai.completion": "File edited successfully.",
        "agent_lens.branch_id": mainBranchId,
        ...cost(680, 120),
      },
      events: [
        {
          name: "error",
          timestamp: ts(400),
          attributes: {
            message: "Wrong file! Should edit controller, not model. The model already has findByIdWithProfile.",
          },
        },
      ],
    },
    500,
    600,
    "error",
  );

  now += 700;

  // ═══ SPAN 11: Thinking — realize mistake ═══
  console.log("[Demo] [11/17] Thinking: realizing mistake...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking5,
      parentSpanId: ids.thinking4,
      name: "Correcting approach",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "agent_lens.reasoning": `Wait — I made a mistake. I edited the model file but the fix should be in the controller. The model already has \`findByIdWithProfile\` which does the correct JOIN query. I need to:

1. Revert the model change
2. Edit the controller to call \`findByIdWithProfile\` instead of \`findById\`
3. Add optional chaining and UUID validation in the controller

Let me fork from the correct point and apply the fix properly.`,
        "agent_lens.branch_id": mainBranchId,
        ...cost(1870, 340),
      },
      events: [],
    },
    1400,
    1000,
  );

  now += 1500;

  // ═══ FORK — Create new branch ═══
  console.log("[Demo] [12/17] Branch: forking to correct path");
  const fixBranch: Branch = {
    branchId: fixBranchId,
    parentBranchId: mainBranchId,
    forkPointSpanId: ids.editFileWrong,
    createdAt: ts(),
    label: "Fix: edit controller instead of model",
    status: "active",
  };
  emit({ type: "branch:create", branch: fixBranch });

  // Abandon old branch
  emit({
    type: "branch:update",
    branchId: mainBranchId,
    updates: { status: "abandoned" },
  });

  // Update session active branch
  emit({
    type: "session:update",
    sessionId,
    updates: { activeBranchId: fixBranchId },
  });

  // Branch span
  await emitSpan(
    {
      traceId,
      spanId: ids.branchSpan,
      parentSpanId: ids.editFileWrong,
      name: "Fork: correct fix in controller",
      kind: "branch",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "agent_lens.branch_id": fixBranchId,
        "agent_lens.parent_branch_id": mainBranchId,
      },
      events: [],
    },
    200,
    400,
  );

  now += 500;

  // ═══ SPAN 13: Thinking on new branch ═══
  console.log("[Demo] [13/17] Thinking: correct approach on new branch...");
  await emitSpan(
    {
      traceId,
      spanId: ids.thinking6,
      parentSpanId: ids.branchSpan,
      name: "Implementing correct fix",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "agent_lens.reasoning": `On the correct branch now. The fix goes in \`users.controller.ts\`:

1. Replace \`UserModel.findById(id)\` with \`UserModel.findByIdWithProfile(id)\`
2. Add optional chaining: \`user.profile?.displayName ?? "Anonymous"\`
3. Add UUID validation at the top of the handler

This is a clean, minimal fix that addresses both bugs without changing the data layer.`,
        "agent_lens.branch_id": fixBranchId,
        ...cost(2100, 290),
      },
      events: [],
    },
    1200,
    900,
  );

  now += 1300;

  // ═══ SPAN 14: Re-read controller ═══
  console.log("[Demo] [14/17] Tool: read_file (re-read controller on fix branch)");
  await emitSpan(
    {
      traceId,
      spanId: ids.readFile4,
      parentSpanId: ids.thinking6,
      name: "read_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "read_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "read_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/controllers/users.controller.ts",
        }),
        "gen_ai.completion": "[File contents displayed — 52 lines]",
        "agent_lens.branch_id": fixBranchId,
        ...cost(780, 140),
      },
      events: [],
    },
    600,
    500,
  );

  now += 700;

  // ═══ SPAN 15: edit_file — CORRECT fix ═══
  console.log("[Demo] [15/17] Tool: edit_file (correct fix!)");
  await emitSpan(
    {
      traceId,
      spanId: ids.editFileCorrect,
      parentSpanId: ids.thinking6,
      name: "edit_file",
      kind: "tool_call",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.action": "edit_file",
        "agent_lens.mcp.server": "filesystem",
        "agent_lens.mcp.tool": "edit_file",
        "agent_lens.mcp.arguments": JSON.stringify({
          path: "src/services/user-service/controllers/users.controller.ts",
          old_string: `  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const isValid = validateUUID(id);

      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const response = {
        id: user.id,
        email: user.email,
        name: user.profile.displayName,
        avatar: user.profile.avatarUrl,
        createdAt: user.createdAt,
      };`,
          new_string: `  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!validateUUID(id)) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      const user = await UserModel.findByIdWithProfile(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const response = {
        id: user.id,
        email: user.email,
        name: user.profile?.displayName ?? "Anonymous",
        avatar: user.profile?.avatarUrl ?? null,
        createdAt: user.createdAt,
      };`,
        }),
        "gen_ai.completion": "File edited successfully. 2 hunks applied.",
        "agent_lens.branch_id": fixBranchId,
        ...cost(1450, 280),
      },
      events: [],
    },
    700,
    700,
  );

  now += 800;

  // ═══ SPAN 16: Run tests again (shell) ═══
  console.log("[Demo] [16/17] Tool: shell_execute (verification tests)");

  const shellSpan2: AgentSpan = {
    traceId,
    spanId: ids.shellExec2,
    parentSpanId: ids.thinking6,
    name: "shell_execute",
    kind: "tool_call",
    startTime: ts(),
    status: "paused",
    attributes: {
      "gen_ai.system": "openclaw",
      "gen_ai.request.model": "claude-opus-4-6",
      "gen_ai.action": "shell_execute",
      "agent_lens.mcp.server": "shell",
      "agent_lens.mcp.tool": "shell_execute",
      "agent_lens.mcp.arguments": JSON.stringify({
        command: "npm test -- --grep 'getUserById' --reporter spec",
        cwd: "src/services/user-service",
        timeout: 30000,
      }),
      "agent_lens.approval_required": true,
      "agent_lens.approval_status": "pending",
      "agent_lens.branch_id": fixBranchId,
      ...cost(380, 70),
    },
    events: [],
  };
  emit({ type: "span:start", span: shellSpan2 });

  const approvalReq2: ApprovalRequest = {
    requestId: uuid(),
    sessionId,
    spanId: ids.shellExec2,
    mcpServer: "shell",
    toolName: "shell_execute",
    arguments: {
      command: "npm test -- --grep 'getUserById' --reporter spec",
      cwd: "src/services/user-service",
      timeout: 30000,
    },
    riskLevel: "high",
    reason: "Shell command execution requires operator approval",
    createdAt: ts(),
  };
  emit({ type: "approval:request", approval: approvalReq2 });

  await delay(1500);

  // Auto-approve
  emit({
    type: "approval:decision",
    decision: {
      requestId: approvalReq2.requestId,
      decision: "approved",
      decidedAt: ts(1400),
      decidedBy: "operator@acme.dev",
    },
  });

  emit({
    type: "span:update",
    spanId: ids.shellExec2,
    updates: {
      status: "pending",
      attributes: {
        ...shellSpan2.attributes,
        "agent_lens.approval_status": "approved",
      },
    },
  });

  await delay(1800);

  emit({
    type: "span:end",
    spanId: ids.shellExec2,
    endTime: ts(3500),
    status: "ok",
  });

  now += 3700;

  // ═══ SPAN 17: Final summary with screenshot ═══
  console.log("[Demo] [17/17] Thinking: final summary with screenshot");

  const screenshot: Attachment = {
    id: uuid(),
    type: "screenshot",
    mimeType: "image/png",
    label: "Test results — all passing",
    dataBase64: PLACEHOLDER_PNG,
    thumbnailBase64: `data:image/png;base64,${PLACEHOLDER_PNG}`,
    width: 800,
    height: 600,
    sizeBytes: 24576,
    timestamp: ts(),
    metadata: { source: "terminal-capture" },
  };

  await emitSpan(
    {
      traceId,
      spanId: ids.thinking7,
      parentSpanId: ids.thinking6,
      name: "Task complete — summary",
      kind: "thinking",
      startTime: ts(),
      status: "pending",
      attributes: {
        "gen_ai.system": "openclaw",
        "gen_ai.request.model": "claude-opus-4-6",
        "gen_ai.response.model": "claude-opus-4-6",
        "gen_ai.response.finish_reason": "stop",
        "agent_lens.reasoning": `All tests pass now:

\`\`\`
  UsersController
    getUserById
      ✓ should return user by valid ID (38ms)
      ✓ should handle user without profile (12ms)
      ✓ should return 404 for nonexistent user (8ms)
      ✓ should reject invalid UUID format (5ms)

  4 passing (63ms)
\`\`\`

**Summary of changes to \`users.controller.ts\`:**
1. Added UUID validation with proper 400 response for invalid IDs
2. Changed \`findById\` → \`findByIdWithProfile\` to eagerly load profile data
3. Added optional chaining (\`user.profile?.displayName\`) with fallback defaults

The root cause was that \`getUserById\` used \`findById\` which doesn't JOIN the profiles table, leaving \`user.profile\` as \`undefined\`. Accessing \`.displayName\` on \`undefined\` threw a TypeError caught by the generic error handler, resulting in a 500 response.`,
        "agent_lens.branch_id": fixBranchId,
        "agent_lens.attachments": JSON.stringify([screenshot]),
        ...cost(3150, 620),
      },
      events: [
        {
          name: "task_complete",
          timestamp: ts(1800),
          attributes: { tests_passed: 4, tests_failed: 0 },
        },
      ],
    },
    2000,
    1500,
  );

  now += 2200;

  // ═══ SESSION COMPLETE ═══
  emit({
    type: "session:update",
    sessionId,
    updates: { status: "completed" },
  });

  // Merge the fix branch
  emit({
    type: "branch:update",
    branchId: fixBranchId,
    updates: { status: "merged" },
  });

  console.log("[Demo] Scenario complete!");
  console.log("[Demo] Total spans: 17");

  // Calculate total cost
  const totalInput = 1240 + 820 + 950 + 2180 + 1560 + 1340 + 3420 + 410 + 2890 + 680 + 1870 + 2100 + 780 + 1450 + 380 + 3150;
  const totalOutput = 387 + 195 + 280 + 410 + 320 + 295 + 580 + 85 + 465 + 120 + 340 + 290 + 140 + 280 + 70 + 620;
  const totalCost = (totalInput / 1_000_000) * 15 + (totalOutput / 1_000_000) * 75;
  console.log(`[Demo] Total tokens: ${totalInput + totalOutput} (${totalInput} in / ${totalOutput} out)`);
  console.log(`[Demo] Estimated cost: $${totalCost.toFixed(4)}`);
}
