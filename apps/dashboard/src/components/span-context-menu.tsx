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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
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
      className="fixed z-50 bg-[--bg-secondary] border border-[--border] rounded-xl shadow-xl shadow-black/30 min-w-[220px] py-1 overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      {!showForkInput ? (
        <>
          <div className="px-3 py-2 border-b border-[--border]">
            <div className="text-xs font-medium truncate">{span.name}</div>
            <div className="text-[11px] text-[--text-tertiary] font-mono mt-0.5">{span.spanId.slice(0, 12)}</div>
          </div>

          <div className="py-1">
            <MenuItem
              label="Fork here"
              hint="Create a new branch"
              onClick={() => setShowForkInput(true)}
            />
            <MenuItem
              label="Rewind to this step"
              hint="Reset agent state"
              onClick={() => { onRewind(span.spanId); onClose(); }}
            />

            <div className="border-t border-[--border] my-1" />

            <MenuItem
              label="Copy span ID"
              hint={span.spanId.slice(0, 12)}
              onClick={() => { navigator.clipboard.writeText(span.spanId); onClose(); }}
            />
          </div>
        </>
      ) : (
        <div className="p-3 space-y-2.5">
          <div className="text-xs font-semibold">Create branch</div>
          <input
            autoFocus
            type="text"
            placeholder="Branch label (optional)"
            value={forkLabel}
            onChange={(e) => setForkLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleForkSubmit(); }}
            className="w-full px-3 py-1.5 text-xs bg-[--bg-tertiary] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent-blue] placeholder:text-[--text-tertiary]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForkInput(false)}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-[--border] text-[--text-secondary] hover:bg-[--bg-hover] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleForkSubmit}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[--accent-blue] text-white font-medium hover:opacity-90 cursor-pointer"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[--bg-hover] transition-colors cursor-pointer"
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[11px] text-[--text-tertiary]">{hint}</span>
    </button>
  );
}
