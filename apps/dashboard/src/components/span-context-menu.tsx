"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentSpan } from "@agent-lens/protocol";

interface SpanContextMenuProps {
  span: AgentSpan;
  position: { x: number; y: number };
  onClose: () => void;
  onFork: (spanId: string, label: string) => void;
  onRewind: (spanId: string) => void;
}

export function SpanContextMenu({
  span,
  position,
  onClose,
  onFork,
  onRewind,
}: SpanContextMenuProps) {
  const [showForkInput, setShowForkInput] = useState(false);
  const [forkLabel, setForkLabel] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleForkSubmit = () => {
    onFork(span.spanId, forkLabel || `Fork at ${span.name}`);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[--bg-tertiary] border border-[--border] rounded-lg shadow-2xl shadow-black/50 min-w-[200px] py-1"
      style={{ left: position.x, top: position.y }}
    >
      {!showForkInput ? (
        <>
          <MenuHeader spanId={span.spanId} name={span.name} />

          <div className="border-t border-[--border] my-1" />

          <MenuItem
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M 3 2 L 3 8 M 3 8 C 3 10 5 10 7 8 M 11 2 L 11 12" />
                <circle cx="3" cy="2" r="1.5" fill="currentColor" />
                <circle cx="11" cy="2" r="1.5" fill="currentColor" />
                <circle cx="11" cy="12" r="1.5" fill="currentColor" />
              </svg>
            }
            label="Fork Here"
            description="Create a new branch from this point"
            onClick={() => setShowForkInput(true)}
            color="text-pink-400"
          />

          <MenuItem
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M 2 7 L 5 4 M 2 7 L 5 10 M 2 7 L 12 7" />
              </svg>
            }
            label="Rewind To"
            description="Reset agent state to this step"
            onClick={() => { onRewind(span.spanId); onClose(); }}
            color="text-yellow-400"
          />

          <div className="border-t border-[--border] my-1" />

          <MenuItem
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="10" height="10" rx="2" />
                <path d="M 5 7 L 9 7" />
              </svg>
            }
            label="Copy Span ID"
            description={span.spanId.slice(0, 12) + "..."}
            onClick={() => { navigator.clipboard.writeText(span.spanId); onClose(); }}
            color="text-[--text-secondary]"
          />
        </>
      ) : (
        <div className="p-3 space-y-2">
          <div className="text-xs font-bold text-pink-400">Create Branch</div>
          <input
            autoFocus
            type="text"
            placeholder="Branch label (optional)"
            value={forkLabel}
            onChange={(e) => setForkLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleForkSubmit(); }}
            className="w-full px-2 py-1.5 text-xs bg-[--bg-primary] border border-[--border] rounded focus:outline-none focus:border-pink-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForkInput(false)}
              className="flex-1 px-2 py-1 text-[10px] rounded border border-[--border] text-[--text-secondary] hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleForkSubmit}
              className="flex-1 px-2 py-1 text-[10px] rounded bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 font-bold cursor-pointer"
            >
              Fork
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuHeader({ spanId, name }: { spanId: string; name: string }) {
  return (
    <div className="px-3 py-1.5">
      <div className="text-xs font-medium truncate">{name}</div>
      <div className="text-[10px] text-[--text-secondary] font-mono">{spanId.slice(0, 12)}</div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  description,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
    >
      <div className={color}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${color}`}>{label}</div>
        <div className="text-[10px] text-[--text-secondary] truncate">{description}</div>
      </div>
    </button>
  );
}
