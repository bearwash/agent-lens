// ─── Agentic Firewall ───
// Security layer that checks MCP tool calls against known threat patterns
// and IOC (Indicators of Compromise) databases before allowing execution.

import { randomUUID } from "node:crypto";
import type {
  ThreatIndicator,
  FirewallVerdict,
  FirewallConfig,
  McpRequest,
} from "@agent-lens/protocol";
import type { Store } from "@agent-lens/store";
import type { EventBus } from "./event-bus.js";

const DEFAULT_INDICATORS: ThreatIndicator[] = [
  // ─── Token Theft (CVE-2026-25253) ───
  {
    id: "tt-001",
    category: "token_theft",
    severity: "critical",
    pattern: "Authorization:\\s*Bearer\\s+[A-Za-z0-9\\-._~+/]+=*",
    matchTarget: "arguments",
    description: "Possible bearer token exfiltration in tool arguments",
    cve: "CVE-2026-25253",
    mitre: "T1528",
  },
  {
    id: "tt-002",
    category: "token_theft",
    severity: "critical",
    pattern: "(api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token)\\s*[:=]\\s*[\"']?[A-Za-z0-9\\-._~+/]{16,}",
    matchTarget: "arguments",
    description: "API key or secret token detected in arguments",
    cve: "CVE-2026-25253",
    mitre: "T1528",
  },
  {
    id: "tt-003",
    category: "token_theft",
    severity: "high",
    pattern: "https?://[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}",
    matchTarget: "url",
    description: "Request to raw IP address — potential token exfiltration endpoint",
    mitre: "T1041",
  },

  // ─── Shell Injection ───
  {
    id: "si-001",
    category: "injection",
    severity: "critical",
    pattern: ";\\s*rm\\s",
    matchTarget: "arguments",
    description: "Shell injection: chained rm command",
    mitre: "T1059.004",
  },
  {
    id: "si-002",
    category: "injection",
    severity: "critical",
    pattern: "\\|\\s*curl\\s",
    matchTarget: "arguments",
    description: "Shell injection: piped curl command",
    mitre: "T1059.004",
  },
  {
    id: "si-003",
    category: "injection",
    severity: "high",
    pattern: "`[^`]+`",
    matchTarget: "arguments",
    description: "Backtick command injection",
    mitre: "T1059.004",
  },
  {
    id: "si-004",
    category: "injection",
    severity: "high",
    pattern: "\\$\\([^)]+\\)",
    matchTarget: "arguments",
    description: "Command substitution injection via $()",
    mitre: "T1059.004",
  },

  // ─── Data Exfiltration ───
  {
    id: "ex-001",
    category: "exfiltration",
    severity: "high",
    pattern: "base64\\s+(/etc/passwd|/etc/shadow|\\.env|\\.ssh/)",
    matchTarget: "arguments",
    description: "Base64 encoding of sensitive files",
    mitre: "T1048",
  },
  {
    id: "ex-002",
    category: "exfiltration",
    severity: "high",
    pattern: "curl\\s+.*-d\\s+.*@",
    matchTarget: "arguments",
    description: "Curl posting file data to external endpoint",
    mitre: "T1048",
  },
  {
    id: "ex-003",
    category: "exfiltration",
    severity: "medium",
    pattern: "curl\\s+.*https?://[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}",
    matchTarget: "arguments",
    description: "Curl to external IP address",
    mitre: "T1048",
  },

  // ─── Credential Access ───
  {
    id: "ca-001",
    category: "credential_theft",
    severity: "high",
    pattern: "(\\.env|\\.env\\.local|\\.env\\.production)",
    matchTarget: "arguments",
    description: "Access to .env file containing secrets",
    mitre: "T1552.001",
  },
  {
    id: "ca-002",
    category: "credential_theft",
    severity: "critical",
    pattern: "\\.ssh/(id_rsa|id_ed25519|id_dsa|authorized_keys|known_hosts|config)",
    matchTarget: "arguments",
    description: "Access to SSH private keys or config",
    mitre: "T1552.004",
  },
  {
    id: "ca-003",
    category: "credential_theft",
    severity: "high",
    pattern: "(credentials\\.json|service[_-]?account\\.json|gcloud.*auth)",
    matchTarget: "arguments",
    description: "Access to cloud credentials file",
    mitre: "T1552.001",
  },

  // ─── Supply Chain ───
  {
    id: "sc-001",
    category: "supply_chain",
    severity: "high",
    pattern: "npm\\s+install\\s+.*--registry\\s+https?://(?!registry\\.npmjs\\.org)",
    matchTarget: "arguments",
    description: "npm install from non-default registry",
    mitre: "T1195.002",
  },
  {
    id: "sc-002",
    category: "supply_chain",
    severity: "high",
    pattern: "pip\\s+install\\s+.*--index-url\\s+https?://(?!pypi\\.org)",
    matchTarget: "arguments",
    description: "pip install from non-PyPI source",
    mitre: "T1195.002",
  },
  {
    id: "sc-003",
    category: "supply_chain",
    severity: "medium",
    pattern: "pip\\s+install\\s+.*--extra-index-url",
    matchTarget: "arguments",
    description: "pip install with extra index URL — dependency confusion risk",
    mitre: "T1195.002",
  },

  // ─── Destructive Operations ───
  {
    id: "ds-001",
    category: "destructive",
    severity: "critical",
    pattern: "rm\\s+-(r|f|rf|fr)\\s",
    matchTarget: "arguments",
    description: "Recursive or forced file deletion",
    mitre: "T1485",
  },
  {
    id: "ds-002",
    category: "destructive",
    severity: "critical",
    pattern: "DROP\\s+(TABLE|DATABASE|SCHEMA)",
    matchTarget: "arguments",
    description: "SQL DROP statement — destructive database operation",
    mitre: "T1485",
  },
  {
    id: "ds-003",
    category: "destructive",
    severity: "critical",
    pattern: "(mkfs|fdisk|format)\\s+/dev/",
    matchTarget: "arguments",
    description: "Disk formatting command",
    mitre: "T1561.002",
  },
  {
    id: "ds-004",
    category: "destructive",
    severity: "high",
    pattern: "TRUNCATE\\s+TABLE",
    matchTarget: "arguments",
    description: "SQL TRUNCATE — destructive data removal",
    mitre: "T1485",
  },
];

const SEVERITY_SCORES: Record<ThreatIndicator["severity"], number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 80,
};

interface FirewallStats {
  totalInspections: number;
  allowed: number;
  blocked: number;
  alerted: number;
  quarantined: number;
}

export class AgenticFirewall {
  private config: FirewallConfig;
  private stats: FirewallStats = {
    totalInspections: 0,
    allowed: 0,
    blocked: 0,
    alerted: 0,
    quarantined: 0,
  };
  private recentVerdicts: FirewallVerdict[] = [];
  private readonly maxRecentVerdicts = 500;

  constructor(
    private store: Store,
    private eventBus: EventBus,
    config?: Partial<FirewallConfig>,
  ) {
    this.config = {
      enabled: config?.enabled ?? true,
      mode: config?.mode ?? "enforce",
      indicators: config?.indicators ?? [...DEFAULT_INDICATORS],
      customRules: config?.customRules ?? [],
      blockThreshold: config?.blockThreshold ?? 50,
    };
  }

  /**
   * Inspect an MCP request against all threat indicators.
   * Returns a FirewallVerdict with the risk assessment.
   */
  inspect(
    sessionId: string,
    spanId: string,
    mcpServer: string,
    request: McpRequest,
  ): FirewallVerdict {
    this.stats.totalInspections++;

    const matchedIndicators: ThreatIndicator[] = [];

    if (!this.config.enabled) {
      const verdict: FirewallVerdict = {
        requestId: randomUUID(),
        spanId,
        allowed: true,
        matchedIndicators: [],
        riskScore: 0,
        timestamp: Date.now(),
        action: "allow",
      };
      this.recordVerdict(verdict);
      return verdict;
    }

    const allIndicators = [...this.config.indicators, ...this.config.customRules];

    // Extract targets for matching
    const toolName = this.extractToolName(request);
    const argsSerialized = JSON.stringify(request.params ?? {});
    const urlsInArgs = this.extractUrls(argsSerialized);
    const reasoning = (request.params as Record<string, unknown> | undefined)?.reasoning as string | undefined;

    for (const indicator of allIndicators) {
      try {
        const regex = new RegExp(indicator.pattern, "i");
        let matched = false;

        switch (indicator.matchTarget) {
          case "tool_name":
            matched = regex.test(toolName);
            break;
          case "arguments":
            matched = regex.test(argsSerialized);
            break;
          case "url":
            matched = urlsInArgs.some((url) => regex.test(url));
            break;
          case "reasoning":
            if (reasoning) matched = regex.test(reasoning);
            break;
        }

        if (matched) {
          matchedIndicators.push(indicator);
        }
      } catch {
        // Invalid regex in indicator — skip silently
      }
    }

    // Calculate risk score: take the max severity score, then add diminishing
    // contributions from additional matches
    let riskScore = 0;
    if (matchedIndicators.length > 0) {
      const scores = matchedIndicators
        .map((ind) => SEVERITY_SCORES[ind.severity])
        .sort((a, b) => b - a);

      riskScore = scores[0];
      for (let i = 1; i < scores.length; i++) {
        // Each additional match adds a diminishing fraction
        riskScore += scores[i] * (0.5 / i);
      }
      riskScore = Math.min(100, Math.round(riskScore));
    }

    // Determine action
    let action: FirewallVerdict["action"];
    let allowed: boolean;

    if (matchedIndicators.length === 0) {
      action = "allow";
      allowed = true;
    } else if (this.config.mode === "monitor") {
      action = "alert";
      allowed = true;
    } else if (riskScore >= this.config.blockThreshold) {
      action = "block";
      allowed = false;
    } else if (riskScore >= this.config.blockThreshold * 0.6) {
      action = "quarantine";
      allowed = false;
    } else {
      action = "alert";
      allowed = true;
    }

    const verdict: FirewallVerdict = {
      requestId: randomUUID(),
      spanId,
      allowed,
      matchedIndicators,
      riskScore,
      timestamp: Date.now(),
      action,
    };

    // Update stats
    switch (action) {
      case "allow": this.stats.allowed++; break;
      case "block": this.stats.blocked++; break;
      case "alert": this.stats.alerted++; break;
      case "quarantine": this.stats.quarantined++; break;
    }

    this.recordVerdict(verdict);

    // Emit dashboard event
    this.eventBus.emit({ type: "firewall:verdict", verdict });

    if (!allowed) {
      console.log(
        `[Firewall] BLOCKED request on span ${spanId} — risk=${riskScore}, ` +
        `matched=${matchedIndicators.map((i) => i.id).join(", ")}`,
      );
    }

    return verdict;
  }

  addIndicator(indicator: ThreatIndicator): void {
    this.config.customRules.push(indicator);
  }

  removeIndicator(id: string): boolean {
    const idx = this.config.customRules.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.config.customRules.splice(idx, 1);
      return true;
    }
    // Also check built-in indicators
    const builtInIdx = this.config.indicators.findIndex((i) => i.id === id);
    if (builtInIdx !== -1) {
      this.config.indicators.splice(builtInIdx, 1);
      return true;
    }
    return false;
  }

  getConfig(): FirewallConfig {
    return { ...this.config };
  }

  getStats(): FirewallStats {
    return { ...this.stats };
  }

  getRecentVerdicts(limit = 50): FirewallVerdict[] {
    return this.recentVerdicts.slice(-limit);
  }

  private recordVerdict(verdict: FirewallVerdict): void {
    this.recentVerdicts.push(verdict);
    if (this.recentVerdicts.length > this.maxRecentVerdicts) {
      this.recentVerdicts = this.recentVerdicts.slice(-this.maxRecentVerdicts);
    }
  }

  private extractToolName(request: McpRequest): string {
    if (request.method === "tools/call") {
      return (request.params as Record<string, unknown>)?.name as string ?? "unknown";
    }
    return request.method;
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s"'`,)}\]]+/gi;
    return text.match(urlRegex) ?? [];
  }
}
