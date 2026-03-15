"use client";

import type { AgentSpan, Attachment } from "@agent-lens/protocol";
import { CostBreakdown } from "./cost-display";
import { AttachmentViewer } from "./attachment-viewer";

interface SpanDetailProps {
  span: AgentSpan | null;
}

export function SpanDetail({ span }: SpanDetailProps) {
  if (!span) {
    return (
      <div className="flex items-center justify-center h-full text-[--text-secondary]">
        Select a span to inspect
      </div>
    );
  }

  const reasoning = String(span.attributes["agent_lens.reasoning"] ?? "");
  const mcpArgs = String(span.attributes["agent_lens.mcp.arguments"] ?? "");

  let parsedArgsStr = "";
  if (mcpArgs) {
    try {
      parsedArgsStr = JSON.stringify(JSON.parse(mcpArgs), null, 2);
    } catch {
      parsedArgsStr = mcpArgs;
    }
  }

  // Parse attachments
  let attachments: Attachment[] = [];
  const rawAttachments = span.attributes["agent_lens.attachments"];
  if (typeof rawAttachments === "string") {
    try {
      attachments = JSON.parse(rawAttachments);
    } catch { /* ignore */ }
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">{span.name}</h2>
        <div className="flex gap-3 mt-1 text-xs text-[--text-secondary]">
          <span>ID: {span.spanId.slice(0, 8)}</span>
          <span>Trace: {span.traceId.slice(0, 8)}</span>
          {span.parentSpanId && <span>Parent: {span.parentSpanId.slice(0, 8)}</span>}
        </div>
      </div>

      {/* Timing */}
      <Section title="Timing">
        <KV label="Start" value={new Date(span.startTime).toISOString()} />
        {span.endTime != null && <KV label="End" value={new Date(span.endTime).toISOString()} />}
        {span.endTime != null && (
          <KV label="Duration" value={`${span.endTime - span.startTime}ms`} />
        )}
        <KV label="Status" value={span.status} />
      </Section>

      {/* Reasoning (Chain of Thought) */}
      {reasoning.length > 0 ? (
        <Section title="Chain of Thought">
          <pre className="text-xs bg-[--bg-primary] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
            {reasoning}
          </pre>
        </Section>
      ) : null}

      {/* MCP Tool Arguments */}
      {parsedArgsStr.length > 0 ? (
        <Section title="Tool Arguments">
          <pre className="text-xs bg-[--bg-primary] p-3 rounded-lg overflow-x-auto">
            {parsedArgsStr}
          </pre>
        </Section>
      ) : null}

      {/* Inference Economics */}
      <CostBreakdown span={span} />

      {/* Multimodal Attachments */}
      {attachments.length > 0 ? (
        <AttachmentViewer attachments={attachments} />
      ) : null}

      {/* OTel Attributes */}
      <Section title="Attributes">
        <div className="space-y-1">
          {Object.entries(span.attributes as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([key, value]) => (
              <KV key={key} label={key} value={String(value)} />
            ))}
        </div>
      </Section>

      {/* Events */}
      {span.events.length > 0 && (
        <Section title="Events">
          <div className="space-y-2">
            {span.events.map((event, i) => (
              <div key={i} className="text-xs bg-[--bg-primary] p-2 rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{event.name}</span>
                  <span className="text-[--text-secondary]">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.attributes && (
                  <pre className="mt-1 text-[10px] opacity-60">
                    {JSON.stringify(event.attributes, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-widest text-[--text-secondary] mb-2 uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[--text-secondary] shrink-0">{label}:</span>
      <span className="truncate font-mono">{value}</span>
    </div>
  );
}
