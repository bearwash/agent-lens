// ─── OpenClaw Event → AgentSpan Mapper ───

import type { AgentSpan, SpanKind } from "@agent-lens/protocol";
import {
  createSpanId,
  GenAIAttributes,
  AgentLensAttributes,
} from "@agent-lens/otel-config";
import type { OpenClawEvent } from "./types.js";

/**
 * Maps an OpenClaw gateway event to an OTel-compliant AgentSpan.
 */
export function mapEventToSpan(
  event: OpenClawEvent,
  traceId: string,
  branchId: string,
): AgentSpan {
  switch (event.type) {
    case "tool_call":
      return mapToolCallEvent(event, traceId, branchId);
    case "thinking":
      return mapThinkingEvent(event, traceId, branchId);
    case "error":
      return mapErrorEvent(event, traceId, branchId);
    case "completion":
      return mapCompletionEvent(event, traceId, branchId);
  }
}

function mapToolCallEvent(
  event: Extract<OpenClawEvent, { type: "tool_call" }>,
  traceId: string,
  branchId: string,
): AgentSpan {
  const hasError = event.error != null;
  const isComplete = event.result !== undefined || hasError;

  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId: event.parentId,
    name: `tool_call: ${event.toolName}`,
    kind: "tool_call",
    startTime: event.timestamp,
    endTime: isComplete ? Date.now() : undefined,
    status: hasError ? "error" : isComplete ? "ok" : "pending",
    attributes: {
      [GenAIAttributes.SYSTEM]: "openclaw",
      [GenAIAttributes.ACTION]: event.toolName,
      [AgentLensAttributes.MCP_SERVER]: event.serverName,
      [AgentLensAttributes.MCP_TOOL]: event.toolName,
      [AgentLensAttributes.MCP_ARGUMENTS]: JSON.stringify(event.arguments),
      [AgentLensAttributes.BRANCH_ID]: branchId,
    },
    events: [
      {
        name: "openclaw.tool_call",
        timestamp: event.timestamp,
        attributes: {
          server: event.serverName,
          tool: event.toolName,
        },
      },
      ...(hasError
        ? [
            {
              name: "openclaw.tool_call.error",
              timestamp: Date.now(),
              attributes: {
                error_code: event.error!.code,
                error_message: event.error!.message,
              },
            },
          ]
        : []),
    ],
  };
}

function mapThinkingEvent(
  event: Extract<OpenClawEvent, { type: "thinking" }>,
  traceId: string,
  branchId: string,
): AgentSpan {
  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId: event.parentId,
    name: "thinking",
    kind: "thinking",
    startTime: event.timestamp,
    endTime: Date.now(),
    status: "ok",
    attributes: {
      [GenAIAttributes.SYSTEM]: "openclaw",
      [AgentLensAttributes.REASONING]: event.content,
      [AgentLensAttributes.BRANCH_ID]: branchId,
    },
    events: [
      {
        name: "openclaw.thinking",
        timestamp: event.timestamp,
      },
    ],
  };
}

function mapErrorEvent(
  event: Extract<OpenClawEvent, { type: "error" }>,
  traceId: string,
  branchId: string,
): AgentSpan {
  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId: event.parentId,
    name: `error: ${event.errorCode}`,
    kind: "tool_call" as SpanKind,
    startTime: event.timestamp,
    endTime: Date.now(),
    status: "error",
    attributes: {
      [GenAIAttributes.SYSTEM]: "openclaw",
      [AgentLensAttributes.BRANCH_ID]: branchId,
    },
    events: [
      {
        name: "openclaw.error",
        timestamp: event.timestamp,
        attributes: {
          error_code: event.errorCode,
          error_message: event.message,
          details: event.details != null ? JSON.stringify(event.details) : undefined,
        },
      },
    ],
  };
}

function mapCompletionEvent(
  event: Extract<OpenClawEvent, { type: "completion" }>,
  traceId: string,
  branchId: string,
): AgentSpan {
  return {
    traceId,
    spanId: createSpanId(),
    parentSpanId: event.parentId,
    name: `completion: ${event.model}`,
    kind: "tool_result" as SpanKind,
    startTime: event.timestamp,
    endTime: Date.now(),
    status: "ok",
    attributes: {
      [GenAIAttributes.SYSTEM]: "openclaw",
      [GenAIAttributes.REQUEST_MODEL]: event.model,
      [GenAIAttributes.USAGE_INPUT_TOKENS]: event.inputTokens,
      [GenAIAttributes.USAGE_OUTPUT_TOKENS]: event.outputTokens,
      [AgentLensAttributes.BRANCH_ID]: branchId,
    },
    events: [
      {
        name: "openclaw.completion",
        timestamp: event.timestamp,
        attributes: {
          model: event.model,
          finish_reason: event.finishReason,
        },
      },
    ],
  };
}
