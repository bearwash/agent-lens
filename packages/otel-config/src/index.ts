// ─── OTel GenAI Semantic Convention Helpers ───
// Maps raw MCP proxy observations into OTel-compliant AgentSpan objects.

import { randomUUID } from "node:crypto";
import type {
  AgentSpan,
  SpanKind,
  SpanAttributes,
  Attachment,
  McpRequest,
  McpResponse,
  ModelPricing,
} from "@agent-lens/protocol";
import { DEFAULT_PRICING } from "@agent-lens/protocol";

// ─── GenAI Semantic Convention Attribute Keys (OTel 1.37+ Full) ───

export const GenAIAttributes = {
  SYSTEM: "gen_ai.system",
  REQUEST_MODEL: "gen_ai.request.model",
  REQUEST_MAX_TOKENS: "gen_ai.request.max_tokens",
  REQUEST_TEMPERATURE: "gen_ai.request.temperature",
  REQUEST_TOP_P: "gen_ai.request.top_p",
  REQUEST_STOP_SEQUENCES: "gen_ai.request.stop_sequences",
  RESPONSE_ID: "gen_ai.response.id",
  RESPONSE_MODEL: "gen_ai.response.model",
  RESPONSE_FINISH_REASON: "gen_ai.response.finish_reason",
  TASK: "gen_ai.task",
  ACTION: "gen_ai.action",
  CHOICE_INDEX: "gen_ai.choice.index",
  USAGE_INPUT_TOKENS: "gen_ai.usage.input_tokens",
  USAGE_OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  USAGE_TOTAL_TOKENS: "gen_ai.usage.total_tokens",
  PROMPT: "gen_ai.prompt",
  COMPLETION: "gen_ai.completion",
} as const;

export const AgentLensAttributes = {
  MCP_SERVER: "agent_lens.mcp.server",
  MCP_TOOL: "agent_lens.mcp.tool",
  MCP_ARGUMENTS: "agent_lens.mcp.arguments",
  REASONING: "agent_lens.reasoning",
  BRANCH_ID: "agent_lens.branch_id",
  PARENT_BRANCH_ID: "agent_lens.parent_branch_id",
  APPROVAL_REQUIRED: "agent_lens.approval_required",
  APPROVAL_STATUS: "agent_lens.approval_status",
  ATTACHMENTS: "agent_lens.attachments",
  COST_INPUT_USD: "agent_lens.cost.input_usd",
  COST_OUTPUT_USD: "agent_lens.cost.output_usd",
  COST_TOTAL_USD: "agent_lens.cost.total_usd",
} as const;

// ─── Span Factory ───

export function createSpanId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export function createTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

export function createToolCallSpan(
  traceId: string,
  parentSpanId: string | undefined,
  mcpServer: string,
  request: McpRequest,
  branchId?: string,
): AgentSpan {
  const toolName =
    request.method === "tools/call"
      ? (request.params?.name as string) ?? request.method
      : request.method;

  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId,
    name: `tool_call: ${toolName}`,
    kind: "tool_call",
    startTime: Date.now(),
    status: "pending",
    attributes: {
      [GenAIAttributes.SYSTEM]: "mcp",
      [GenAIAttributes.ACTION]: toolName,
      [AgentLensAttributes.MCP_SERVER]: mcpServer,
      [AgentLensAttributes.MCP_TOOL]: toolName,
      [AgentLensAttributes.MCP_ARGUMENTS]: JSON.stringify(request.params ?? {}),
      ...(branchId ? { [AgentLensAttributes.BRANCH_ID]: branchId } : {}),
    },
    events: [
      {
        name: "mcp.request.sent",
        timestamp: Date.now(),
        attributes: { method: request.method },
      },
    ],
  };
}

export function completeSpanWithResponse(
  span: AgentSpan,
  response: McpResponse,
): AgentSpan {
  const now = Date.now();
  const hasError = response.error != null;

  return {
    ...span,
    endTime: now,
    status: hasError ? "error" : "ok",
    events: [
      ...span.events,
      {
        name: hasError ? "mcp.response.error" : "mcp.response.success",
        timestamp: now,
        attributes: hasError
          ? { error_code: response.error!.code, error_message: response.error!.message }
          : undefined,
      },
    ],
  };
}

export function createThinkingSpan(
  traceId: string,
  parentSpanId: string | undefined,
  reasoning: string,
  branchId?: string,
): AgentSpan {
  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId,
    name: "thinking",
    kind: "thinking",
    startTime: Date.now(),
    status: "pending",
    attributes: {
      [AgentLensAttributes.REASONING]: reasoning,
      ...(branchId ? { [AgentLensAttributes.BRANCH_ID]: branchId } : {}),
    },
    events: [],
  };
}

export function createBranchSpan(
  traceId: string,
  forkPointSpanId: string,
  newBranchId: string,
  parentBranchId: string,
  label?: string,
): AgentSpan {
  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId: forkPointSpanId,
    name: `branch: ${label ?? newBranchId}`,
    kind: "branch",
    startTime: Date.now(),
    status: "ok",
    attributes: {
      [AgentLensAttributes.BRANCH_ID]: newBranchId,
      [AgentLensAttributes.PARENT_BRANCH_ID]: parentBranchId,
    },
    events: [
      {
        name: "branch.created",
        timestamp: Date.now(),
        attributes: { label },
      },
    ],
  };
}

// ─── Inference Cost Calculator ───

let pricingTable: ModelPricing[] = [...DEFAULT_PRICING];

export function setPricingTable(pricing: ModelPricing[]): void {
  pricingTable = pricing;
}

export function getPricingTable(): ModelPricing[] {
  return pricingTable;
}

export function findPricing(model: string): ModelPricing | undefined {
  return pricingTable.find((p) => model.includes(p.model) || p.model.includes(model));
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputUsd: number; outputUsd: number; totalUsd: number } {
  const pricing = findPricing(model);
  if (!pricing) {
    return { inputUsd: 0, outputUsd: 0, totalUsd: 0 };
  }
  const inputUsd = (inputTokens / 1_000_000) * pricing.inputPricePerMToken;
  const outputUsd = (outputTokens / 1_000_000) * pricing.outputPricePerMToken;
  return { inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

/**
 * Enriches a span with cost attributes based on token usage.
 */
export function enrichSpanWithCost(span: AgentSpan): AgentSpan {
  const model =
    (span.attributes[GenAIAttributes.RESPONSE_MODEL] as string) ??
    (span.attributes[GenAIAttributes.REQUEST_MODEL] as string);
  const inputTokens = (span.attributes[GenAIAttributes.USAGE_INPUT_TOKENS] as number) ?? 0;
  const outputTokens = (span.attributes[GenAIAttributes.USAGE_OUTPUT_TOKENS] as number) ?? 0;

  if (!model || (inputTokens === 0 && outputTokens === 0)) {
    return span;
  }

  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    ...span,
    attributes: {
      ...span.attributes,
      [GenAIAttributes.USAGE_TOTAL_TOKENS]: inputTokens + outputTokens,
      [AgentLensAttributes.COST_INPUT_USD]: cost.inputUsd,
      [AgentLensAttributes.COST_OUTPUT_USD]: cost.outputUsd,
      [AgentLensAttributes.COST_TOTAL_USD]: cost.totalUsd,
    },
  };
}

// ─── Multimodal Attachment Helpers ───

export function attachToSpan(span: AgentSpan, attachment: Attachment): AgentSpan {
  const existing = span.attributes[AgentLensAttributes.ATTACHMENTS];
  let attachments: Attachment[] = [];
  if (typeof existing === "string") {
    try {
      attachments = JSON.parse(existing);
    } catch { /* ignore */ }
  }
  attachments.push(attachment);

  return {
    ...span,
    attributes: {
      ...span.attributes,
      [AgentLensAttributes.ATTACHMENTS]: JSON.stringify(attachments),
    },
    events: [
      ...span.events,
      {
        name: "attachment.added",
        timestamp: Date.now(),
        attributes: {
          attachment_id: attachment.id,
          attachment_type: attachment.type,
          mime_type: attachment.mimeType,
          size_bytes: attachment.sizeBytes,
        },
      },
    ],
  };
}

export function getAttachments(span: AgentSpan): Attachment[] {
  const raw = span.attributes[AgentLensAttributes.ATTACHMENTS];
  if (typeof raw !== "string") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ─── OTLP Export Helper ───

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;          // OTLP SpanKind enum
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  status: { code: number; message?: string };
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
}

const SPAN_KIND_MAP: Record<SpanKind, number> = {
  thinking: 1,           // INTERNAL
  tool_call: 3,          // CLIENT
  tool_result: 4,        // SERVER (from tool's perspective)
  retry: 1,              // INTERNAL
  user_intervention: 1,  // INTERNAL
  branch: 1,             // INTERNAL
};

const STATUS_CODE_MAP: Record<string, number> = {
  ok: 1,
  error: 2,
  pending: 0,
  paused: 0,
};

/**
 * Converts an AgentSpan to OTLP wire format for export to
 * Datadog, Grafana, Jaeger, or any OTLP-compatible backend.
 */
export function toOtlpSpan(span: AgentSpan): OtlpSpan {
  const attributes = Object.entries(span.attributes)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string")  return { key, value: { stringValue: value } };
      if (typeof value === "number")  return Number.isInteger(value)
        ? { key, value: { intValue: String(value) } }
        : { key, value: { doubleValue: value } };
      if (typeof value === "boolean") return { key, value: { boolValue: value } };
      return { key, value: { stringValue: JSON.stringify(value) } };
    });

  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: SPAN_KIND_MAP[span.kind] ?? 1,
    startTimeUnixNano: String(span.startTime * 1_000_000),
    endTimeUnixNano: span.endTime ? String(span.endTime * 1_000_000) : undefined,
    status: { code: STATUS_CODE_MAP[span.status] ?? 0 },
    attributes,
  };
}
