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
      <div className="flex flex-col items-center justify-center h-full text-[--text-secondary] gap-2">
        <span className="text-sm">Select a span to inspect</span>
        <span className="text-xs text-[--text-tertiary]">Click any item in the timeline, or right-click for options</span>
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
    <div className="p-5 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold">{span.name}</h2>
        <div className="flex gap-3 mt-1.5 text-xs text-[--text-tertiary] font-mono">
          <span>{span.spanId.slice(0, 8)}</span>
          <span>&middot;</span>
          <span>trace {span.traceId.slice(0, 8)}</span>
          {span.parentSpanId && (
            <>
              <span>&middot;</span>
              <span>parent {span.parentSpanId.slice(0, 8)}</span>
            </>
          )}
        </div>
      </div>

      {/* Timing */}
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <KV label="Started" value={new Date(span.startTime).toLocaleTimeString()} />
          {span.endTime != null && <KV label="Ended" value={new Date(span.endTime).toLocaleTimeString()} />}
          {span.endTime != null && (
            <KV label="Duration" value={`${span.endTime - span.startTime}ms`} />
          )}
          <KV label="Status" value={span.status} />
        </div>
      </Section>

      {/* Chain of Thought */}
      {reasoning.length > 0 ? (
        <Section title="Reasoning">
          <div className="text-[13px] bg-[--bg-tertiary] p-3.5 rounded-lg leading-relaxed whitespace-pre-wrap break-words text-[--text-primary]">
            {reasoning}
          </div>
        </Section>
      ) : null}

      {/* Tool Arguments */}
      {parsedArgsStr.length > 0 ? (
        <Section title="Arguments">
          <pre className="text-xs font-mono bg-[--bg-tertiary] p-3.5 rounded-lg overflow-x-auto text-[--text-secondary]">
            {parsedArgsStr}
          </pre>
        </Section>
      ) : null}

      {/* Cost */}
      <CostBreakdown span={span} />

      {/* Attachments */}
      {attachments.length > 0 ? (
        <AttachmentViewer attachments={attachments} />
      ) : null}

      {/* Attributes */}
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
          <div className="space-y-1.5">
            {span.events.map((event, i) => (
              <div key={i} className="text-xs bg-[--bg-tertiary] p-2.5 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium text-[--text-primary]">{event.name}</span>
                  <span className="text-[--text-tertiary] tabular-nums">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.attributes && (
                  <pre className="mt-1.5 text-[11px] font-mono text-[--text-tertiary]">
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
      <h3 className="text-xs font-semibold text-[--text-tertiary] mb-2">{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[--text-tertiary] shrink-0">{label}</span>
      <span className="truncate font-mono text-[--text-secondary]">{value}</span>
    </div>
  );
}
