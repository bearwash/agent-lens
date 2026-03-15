// ─── Approval Gate ───
// Intercepts high-risk MCP tool calls and pauses execution
// until a human operator approves, rejects, or modifies them.

import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalRule,
  McpRequest,
} from "@agent-lens/protocol";
import type { Store } from "@agent-lens/store";
import type { EventBus } from "./event-bus.js";

export class ApprovalGate {
  private rules: ApprovalRule[] = [];
  private pendingResolvers = new Map<string, (decision: ApprovalDecision) => void>();

  constructor(
    private store: Store,
    private eventBus: EventBus,
  ) {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    this.rules = [
      {
        id: "shell-commands",
        name: "Shell command execution",
        enabled: true,
        conditions: [{ type: "tool_name", pattern: "shell_*" }],
        riskLevel: "high",
      },
      {
        id: "file-delete",
        name: "File deletion operations",
        enabled: true,
        conditions: [{ type: "tool_name", pattern: "*delete*" }],
        riskLevel: "critical",
      },
      {
        id: "write-operations",
        name: "File write operations",
        enabled: false, // Disabled by default — too noisy
        conditions: [{ type: "tool_name", pattern: "*write*" }],
        riskLevel: "medium",
      },
    ];
  }

  setRules(rules: ApprovalRule[]): void {
    this.rules = rules;
  }

  getRules(): ApprovalRule[] {
    return [...this.rules];
  }

  /**
   * Check if a request requires approval. Returns null if no approval needed.
   * If approval is needed, creates an ApprovalRequest and waits for a decision.
   */
  async checkAndWait(
    sessionId: string,
    spanId: string,
    mcpServer: string,
    request: McpRequest,
  ): Promise<ApprovalDecision | null> {
    const matchedRule = this.matchRule(request);
    if (!matchedRule) return null;

    const toolName = this.extractToolName(request);

    const approvalRequest: ApprovalRequest = {
      requestId: randomUUID(),
      sessionId,
      spanId,
      mcpServer,
      toolName,
      arguments: (request.params ?? {}) as Record<string, unknown>,
      riskLevel: matchedRule.riskLevel,
      reason: `Matched rule: ${matchedRule.name}`,
      createdAt: Date.now(),
    };

    await this.store.createApprovalRequest(approvalRequest);
    this.eventBus.emit({ type: "approval:request", approval: approvalRequest });

    // Wait for human decision
    return new Promise<ApprovalDecision>((resolve) => {
      this.pendingResolvers.set(approvalRequest.requestId, resolve);
    });
  }

  /**
   * Called by the dashboard when a human makes a decision.
   */
  async submitDecision(decision: ApprovalDecision): Promise<void> {
    await this.store.saveApprovalDecision(decision);
    this.eventBus.emit({ type: "approval:decision", decision });

    const resolver = this.pendingResolvers.get(decision.requestId);
    if (resolver) {
      resolver(decision);
      this.pendingResolvers.delete(decision.requestId);
    }
  }

  private matchRule(request: McpRequest): ApprovalRule | null {
    const toolName = this.extractToolName(request);

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      for (const condition of rule.conditions) {
        if (condition.type === "tool_name" && this.globMatch(toolName, condition.pattern)) {
          return rule;
        }
        if (condition.type === "server_name") {
          // Server name matching is handled at call site
          continue;
        }
        if (condition.type === "argument_match") {
          const args = request.params as Record<string, unknown> | undefined;
          const value = args?.[condition.key];
          if (typeof value === "string" && this.globMatch(value, condition.pattern)) {
            return rule;
          }
        }
      }
    }

    return null;
  }

  private extractToolName(request: McpRequest): string {
    if (request.method === "tools/call") {
      return (request.params as Record<string, unknown>)?.name as string ?? "unknown";
    }
    return request.method;
  }

  private globMatch(value: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    return regex.test(value);
  }
}
