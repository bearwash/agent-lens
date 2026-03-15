// ─── Event Bus ───
// Pub/sub for streaming DashboardEvents to all connected clients.

import type { DashboardEvent } from "@agent-lens/protocol";

export type EventListener = (event: DashboardEvent) => void;

export class EventBus {
  private listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: DashboardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[EventBus] Listener error:", err);
      }
    }
  }
}
