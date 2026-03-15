// ─── Claude Code Tool Mapper ───
// Maps Claude Code's built-in tools to categories with risk levels
// and suggested approval rules.

import type { ApprovalRule } from "@agent-lens/protocol";

export interface ToolMapping {
  /** Human-readable category */
  category: ToolCategory;
  /** Human-readable span name */
  spanName: string;
  /** Default risk level for approval gating */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Description of what this tool does */
  description: string;
}

export type ToolCategory =
  | "file_ops"
  | "search"
  | "execution"
  | "network"
  | "notebook"
  | "task_mgmt"
  | "version_control"
  | "unknown";

// ─── Claude Code Tool Registry ───

const TOOL_MAP: Record<string, ToolMapping> = {
  // File operations
  Read: {
    category: "file_ops",
    spanName: "Read File",
    riskLevel: "low",
    description: "Reads a file from the local filesystem",
  },
  Write: {
    category: "file_ops",
    spanName: "Write File",
    riskLevel: "medium",
    description: "Writes or overwrites a file on disk",
  },
  Edit: {
    category: "file_ops",
    spanName: "Edit File",
    riskLevel: "medium",
    description: "Performs exact string replacements in files",
  },
  Glob: {
    category: "file_ops",
    spanName: "Glob Search",
    riskLevel: "low",
    description: "Fast file pattern matching across the codebase",
  },

  // Search
  Grep: {
    category: "search",
    spanName: "Grep Search",
    riskLevel: "low",
    description: "Searches file contents using ripgrep",
  },
  Agent: {
    category: "search",
    spanName: "Sub-Agent",
    riskLevel: "medium",
    description: "Spawns a sub-agent for open-ended research tasks",
  },

  // Execution
  Bash: {
    category: "execution",
    spanName: "Bash Command",
    riskLevel: "high",
    description: "Executes a bash command in the shell",
  },

  // Network
  WebFetch: {
    category: "network",
    spanName: "Web Fetch",
    riskLevel: "medium",
    description: "Fetches content from a URL",
  },
  WebSearch: {
    category: "network",
    spanName: "Web Search",
    riskLevel: "low",
    description: "Searches the web for information",
  },

  // Notebook
  NotebookEdit: {
    category: "notebook",
    spanName: "Notebook Edit",
    riskLevel: "medium",
    description: "Edits a Jupyter notebook cell",
  },

  // Task management
  TodoRead: {
    category: "task_mgmt",
    spanName: "Read Todos",
    riskLevel: "low",
    description: "Reads the current task list",
  },
  TodoWrite: {
    category: "task_mgmt",
    spanName: "Write Todos",
    riskLevel: "low",
    description: "Updates the task list",
  },
  TaskCreate: {
    category: "task_mgmt",
    spanName: "Create Task",
    riskLevel: "low",
    description: "Creates a new task",
  },
  TaskUpdate: {
    category: "task_mgmt",
    spanName: "Update Task",
    riskLevel: "low",
    description: "Updates an existing task",
  },
  TaskComplete: {
    category: "task_mgmt",
    spanName: "Complete Task",
    riskLevel: "low",
    description: "Marks a task as complete",
  },

  // Version control
  EnterWorktree: {
    category: "version_control",
    spanName: "Enter Worktree",
    riskLevel: "medium",
    description: "Enters a git worktree for parallel work",
  },
  ExitWorktree: {
    category: "version_control",
    spanName: "Exit Worktree",
    riskLevel: "low",
    description: "Exits the current git worktree",
  },

  // Skills
  Skill: {
    category: "execution",
    spanName: "Invoke Skill",
    riskLevel: "medium",
    description: "Invokes a Claude Code skill (slash command)",
  },
  ToolSearch: {
    category: "search",
    spanName: "Tool Search",
    riskLevel: "low",
    description: "Searches for available deferred tools",
  },
};

/**
 * Look up the mapping for a Claude Code tool name.
 * Returns a default "unknown" mapping for unrecognized tools.
 */
export function getToolMapping(toolName: string): ToolMapping {
  return TOOL_MAP[toolName] ?? {
    category: "unknown" as ToolCategory,
    spanName: toolName,
    riskLevel: "medium" as const,
    description: `Unknown Claude Code tool: ${toolName}`,
  };
}

/**
 * Get the human-readable span name for a Claude Code tool.
 */
export function getSpanName(toolName: string): string {
  return getToolMapping(toolName).spanName;
}

/**
 * Get the risk level for a Claude Code tool.
 */
export function getRiskLevel(toolName: string): "low" | "medium" | "high" | "critical" {
  return getToolMapping(toolName).riskLevel;
}

/**
 * Get all registered tool names.
 */
export function getRegisteredTools(): string[] {
  return Object.keys(TOOL_MAP);
}

/**
 * Get all tools in a given category.
 */
export function getToolsByCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_MAP)
    .filter(([, mapping]) => mapping.category === category)
    .map(([name]) => name);
}

/**
 * Generate suggested approval rules for Claude Code tools.
 * These can be used to pre-populate the approval gate configuration.
 */
export function generateDefaultApprovalRules(): ApprovalRule[] {
  return [
    {
      id: "claude-code-bash-all",
      name: "Approve all Bash commands",
      enabled: true,
      conditions: [{ type: "tool_name", pattern: "Bash" }],
      riskLevel: "high",
    },
    {
      id: "claude-code-write-ops",
      name: "Approve file write operations",
      enabled: false,
      conditions: [{ type: "tool_name", pattern: "Write" }],
      riskLevel: "medium",
    },
    {
      id: "claude-code-edit-ops",
      name: "Approve file edit operations",
      enabled: false,
      conditions: [{ type: "tool_name", pattern: "Edit" }],
      riskLevel: "medium",
    },
    {
      id: "claude-code-network",
      name: "Approve network access",
      enabled: false,
      conditions: [{ type: "tool_name", pattern: "WebFetch" }],
      riskLevel: "medium",
    },
    {
      id: "claude-code-destructive-bash",
      name: "Flag destructive bash commands",
      enabled: true,
      conditions: [
        { type: "tool_name", pattern: "Bash" },
        { type: "keyword", pattern: "rm -rf|git reset --hard|git push --force|drop table" },
      ],
      riskLevel: "critical",
    },
  ];
}
