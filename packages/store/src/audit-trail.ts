// ─── Phase 4: Reconstitution of Intent — Audit Trail Engine ───
// Cryptographically chained, append-only audit log for legally admissible exports.

import { createHash } from "node:crypto";
import type {
  AuditTrailEntry,
  AuditEvent,
  AuditExportOptions,
} from "@agent-lens/protocol";
import type { Store } from "./index.js";

/** Genesis hash: 64 hex zeroes (SHA-256 of nothing, by convention). */
const GENESIS_HASH = "0".repeat(64);

export class AuditTrail {
  private entries: AuditTrailEntry[] = [];
  private seq = 0;
  private prevHash: string = GENESIS_HASH;

  constructor(
    private store: Store,
  ) {}

  // ─── Core Recording ───

  async record(event: AuditEvent): Promise<AuditTrailEntry> {
    this.seq++;

    const timestamp = new Date().toISOString();
    const contentPayload = JSON.stringify({ seq: this.seq, timestamp, event });
    const contentHash = createHash("sha256")
      .update(contentPayload)
      .digest("hex");

    const entry: AuditTrailEntry = {
      seq: this.seq,
      timestamp,
      prevHash: this.prevHash,
      contentHash,
      event,
    };

    // Chain: next entry's prevHash = this entry's contentHash
    this.prevHash = contentHash;

    // Append-only storage
    this.entries.push(entry);

    return entry;
  }

  // ─── Chain Verification ───

  async verify(): Promise<{ valid: boolean; brokenAt?: number }> {
    let expectedPrevHash = GENESIS_HASH;

    for (const entry of this.entries) {
      // Check chain link
      if (entry.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: entry.seq };
      }

      // Recompute content hash and verify
      const contentPayload = JSON.stringify({
        seq: entry.seq,
        timestamp: entry.timestamp,
        event: entry.event,
      });
      const recomputedHash = createHash("sha256")
        .update(contentPayload)
        .digest("hex");

      if (entry.contentHash !== recomputedHash) {
        return { valid: false, brokenAt: entry.seq };
      }

      expectedPrevHash = entry.contentHash;
    }

    return { valid: true };
  }

  // ─── Export ───

  async export(options: AuditExportOptions): Promise<string> {
    const entries = await this.getEntries(options.sessionId);

    switch (options.format) {
      case "jsonl":
        return entries.map((e) => JSON.stringify(e)).join("\n");

      case "csv":
        return this.exportCsv(entries);

      case "parquet":
        // Parquet requires a binary writer; for MVP, fall back to JSONL with a note.
        throw new Error(
          "Parquet export is not yet implemented. Use 'jsonl' or 'csv' format.",
        );

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportCsv(entries: AuditTrailEntry[]): string {
    const headers = [
      "seq",
      "timestamp",
      "prevHash",
      "contentHash",
      "event_type",
      "event_data",
    ];
    const rows = entries.map((e) => [
      String(e.seq),
      e.timestamp,
      e.prevHash,
      e.contentHash,
      e.event.type,
      // Escape double quotes in JSON for CSV safety
      `"${JSON.stringify(e.event).replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  // ─── Queries ───

  async getEntries(sessionId: string): Promise<AuditTrailEntry[]> {
    return this.entries.filter((entry) => {
      const evt = entry.event;
      switch (evt.type) {
        case "session.start":
          return evt.session.sessionId === sessionId;
        case "session.end":
          return evt.sessionId === sessionId;
        case "span.recorded":
          // Match spans by trace — spans don't carry sessionId directly,
          // so we include all span entries for the session.
          return true;
        case "branch.created":
          return true;
        case "approval.requested":
          return evt.request.sessionId === sessionId;
        case "approval.decided":
          return true;
        case "intervention.reasoning_edited":
          return true;
        default:
          return true;
      }
    });
  }

  async getEntry(seq: number): Promise<AuditTrailEntry | undefined> {
    return this.entries.find((e) => e.seq === seq);
  }
}
