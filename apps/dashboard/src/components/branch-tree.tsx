"use client";

import type { Branch } from "@agent-lens/protocol";
import type { TranslationKey } from "@/lib/i18n";

interface BranchTreeProps {
  branches: Map<string, Branch>;
  activeBranchId: string;
  onSelectBranch: (branchId: string) => void;
  t: (key: TranslationKey) => string;
}

const BRANCH_DOTS = ["bg-blue-400", "bg-rose-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400", "bg-cyan-400"];

export function BranchTree({ branches, activeBranchId, onSelectBranch, t }: BranchTreeProps) {
  const branchList = [
    { branchId: "main", parentBranchId: undefined, createdAt: 0, status: "active" as const, label: t("timeline.main") },
    ...[...branches.values()],
  ];

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-[--text-tertiary] mb-2">{t("branches.title")}</h3>
      <div className="space-y-0.5">
        {branchList.map((branch, i) => {
          const isActive = branch.branchId === activeBranchId;
          const dotColor = BRANCH_DOTS[i % BRANCH_DOTS.length];
          const depth = getDepth(branch, branches);

          return (
            <button key={branch.branchId} onClick={() => onSelectBranch(branch.branchId)}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer
                ${isActive ? "bg-[--bg-hover] text-[--text-primary]" : "text-[--text-secondary] hover:bg-[--bg-hover]"}`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
            >
              {depth > 0 && (
                <svg width="10" height="10" viewBox="0 0 10 10" className="text-[--text-tertiary] shrink-0">
                  <path d="M 2 0 L 2 5 L 8 5" stroke="currentColor" fill="none" strokeWidth="1.2" />
                </svg>
              )}
              <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="truncate font-medium">{branch.label ?? branch.branchId}</span>
              {branch.status === "abandoned" && (
                <span className="text-[10px] text-[--text-tertiary] ml-auto">{t("branches.abandoned")}</span>
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
