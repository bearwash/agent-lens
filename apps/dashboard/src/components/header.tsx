"use client";

import type { AgentSpan } from "@agent-lens/protocol";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { CostDisplay } from "./cost-display";

interface HeaderProps {
  connected: boolean;
  sessionCount: number;
  spanCount: number;
  pendingApprovals: number;
  spans: Map<string, AgentSpan>;
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

export function Header({ connected, sessionCount, spanCount, pendingApprovals, spans, locale, onLocaleChange, t }: HeaderProps) {
  return (
    <header className="border-b border-[--border] bg-[--bg-secondary]">
      <div className="h-12 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[--accent-blue] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
                <circle cx="6" cy="6" r="1.5" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold">Agent Lens</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {pendingApprovals > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingApprovals}{t("header.pending")}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-[--text-secondary]">
            <span>{sessionCount} {t(sessionCount === 1 ? "header.session" : "header.sessions")}</span>
            <span className="text-[--border]">|</span>
            <span>{spanCount} {t(spanCount === 1 ? "header.span" : "header.spans")}</span>
          </div>

          {/* Locale switcher */}
          <button
            onClick={() => onLocaleChange(locale === "en" ? "ja" : "en")}
            className="px-2 py-1 text-[11px] font-medium rounded-md bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer"
          >
            {locale === "en" ? "JA" : "EN"}
          </button>

          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
            <span className="text-xs text-[--text-secondary]">
              {t(connected ? "header.connected" : "header.reconnecting")}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-2">
        <CostDisplay spans={spans} t={t} />
      </div>
    </header>
  );
}
