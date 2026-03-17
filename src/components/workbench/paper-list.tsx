"use client";

import clsx from "clsx";
import type { PaperListItemData } from "@/hooks/use-papers";

export function PaperList({
  search,
  onSearchChange,
  papers,
  selectedPaperId,
  onSelectPaper,
  totalPending
}: {
  search: string;
  onSearchChange: (value: string) => void;
  papers: PaperListItemData[];
  selectedPaperId: string | null;
  onSelectPaper: (paperId: string) => void;
  totalPending?: number;
}) {
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="hairline-bottom px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Pending
          </span>
          {totalPending !== undefined && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgba(202,138,4,0.12)", color: "var(--pending)" }}
            >
              {totalPending}
            </span>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search papers…"
          className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)]"
          style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {papers.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]"
            style={{ borderWidth: "var(--hairline)" }}
          >
            {search ? "No papers match your search." : "All papers have been processed!"}
          </div>
        ) : (
          papers.map((paper) => (
            <button
              key={paper.id}
              type="button"
              onClick={() => onSelectPaper(paper.id)}
              className={clsx(
                "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                paper.id === selectedPaperId
                  ? "bg-[var(--panel-muted)]"
                  : "bg-transparent hover:bg-[var(--panel-muted)]/60"
              )}
              style={{
                borderWidth: "var(--hairline)",
                borderColor: "var(--border)",
                borderLeftWidth: 3,
                borderLeftColor: "var(--pending)"
              }}
            >
              <div className="line-clamp-2 text-sm font-medium leading-5">{paper.title}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="truncate">{paper.firstAuthor || "Unknown"}</span>
                <span>·</span>
                <span className="shrink-0">{paper.year ?? "n.d."}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
