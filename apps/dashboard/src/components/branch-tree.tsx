"use client";

import type { Branch } from "@agent-lens/protocol";

interface BranchTreeProps {
  branches: Map<string, Branch>;
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
}

const BRANCH_COLORS = [
  "bg-blue-400",
  "bg-pink-400",
  "bg-green-400",
  "bg-purple-400",
  "bg-orange-400",
  "bg-cyan-400",
];

export function BranchTree({ branches, activeBranchId, onSelectBranch }: BranchTreeProps) {
  const branchList = [
    // Always include "main" as the root
    {
      branchId: "main",
      parentBranchId: undefined,
      createdAt: 0,
      status: "active" as const,
      label: "Main",
    },
    ...[...branches.values()],
  ];

  // Build tree structure
  const childMap = new Map<string, Branch[]>();
  for (const branch of branchList) {
    const parentId = branch.parentBranchId ?? "__root__";
    const children = childMap.get(parentId) ?? [];
    children.push(branch);
    childMap.set(parentId, children);
  }

  return (
    <div className="p-3">
      <h3 className="text-[10px] font-bold tracking-widest text-[--text-secondary] uppercase mb-2">
        Branches
      </h3>
      <div className="space-y-1">
        {branchList.map((branch, i) => {
          const isActive = branch.branchId === activeBranchId;
          const colorClass = BRANCH_COLORS[i % BRANCH_COLORS.length];
          const depth = getDepth(branch, branches);

          return (
            <button
              key={branch.branchId}
              onClick={() => onSelectBranch(branch.branchId)}
              className={`
                w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs
                transition-colors cursor-pointer
                ${isActive ? "bg-white/10 text-white" : "text-[--text-secondary] hover:bg-white/5"}
              `}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {/* Branch indicator */}
              <div className="flex items-center gap-1.5">
                {depth > 0 && (
                  <svg width="12" height="12" viewBox="0 0 12 12" className="opacity-30">
                    <path d="M 2 0 L 2 6 L 10 6" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                )}
                <div className={`w-2 h-2 rounded-full ${colorClass} ${isActive ? "ring-2 ring-white/30" : ""}`} />
              </div>

              {/* Label */}
              <span className="truncate">
                {branch.label ?? branch.branchId}
              </span>

              {/* Status badge */}
              {branch.status === "abandoned" && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 ml-auto">
                  abandoned
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getDepth(branch: Branch, allBranches: Map<string, Branch>): number {
  let depth = 0;
  let current = branch;
  while (current.parentBranchId && current.parentBranchId !== "main") {
    const parent = allBranches.get(current.parentBranchId);
    if (!parent) break;
    current = parent;
    depth++;
  }
  if (branch.branchId !== "main" && branch.parentBranchId) depth++;
  return depth;
}
