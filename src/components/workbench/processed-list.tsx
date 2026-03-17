"use client";

import clsx from "clsx";
import type { PaperListItemData } from "@/hooks/use-papers";

type ProcessedFilter = "all" | "included" | "excluded" | "uncertain";

const FILTERS: Array<{ key: ProcessedFilter; label: string; color: string }> = [
  { key: "all", label: "All", color: "var(--text-muted)" },
  { key: "included", label: "Included", color: "var(--included)" },
  { key: "excluded", label: "Excluded", color: "var(--excluded)" },
  { key: "uncertain", label: "Uncertain", color: "var(--pending)" }
];

function statusColor(status: string) {
  if (status === "included") return "var(--included)";
  if (status === "excluded") return "var(--excluded)";
  return "var(--pending)";
}

function statusLabel(status: string) {
  if (status === "included") return "In";
  if (status === "excluded") return "Out";
  return "?";
}

export function ProcessedList({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  papers,
  selectedPaperId,
  onSelectPaper
}: {
  filter: ProcessedFilter;
  onFilterChange: (f: ProcessedFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  papers: PaperListItemData[];
  selectedPaperId: string | null;
  onSelectPaper: (id: string) => void;
}) {
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="hairline-bottom px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Processed
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
            style={{ background: "var(--panel-muted)" }}
          >
            {papers.length}
          </span>
        </div>
        <div className="flex gap-1 rounded-2xl bg-[var(--panel-muted)] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange(f.key)}
              className="flex-1 rounded-xl px-1.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filter === f.key ? "var(--panel)" : "transparent",
                color: filter === f.key ? f.color : "var(--text-muted)",
                boxShadow: filter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search processed…"
          className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)]"
          style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {papers.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]"
            style={{ borderWidth: "var(--hairline)" }}
          >
            No processed papers yet.
          </div>
        ) : (
          papers.map((paper) => {
            const color = statusColor(paper.status);
            const selected = paper.id === selectedPaperId;
            return (
              <button
                key={paper.id}
                type="button"
                onClick={() => onSelectPaper(paper.id)}
                className={clsx(
                  "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                  selected ? "bg-[var(--panel-muted)]" : "bg-transparent hover:bg-[var(--panel-muted)]/60"
                )}
                style={{
                  borderWidth: "var(--hairline)",
                  borderColor: "var(--border)",
                  borderLeftWidth: 3,
                  borderLeftColor: color
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium leading-5">{paper.title}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className="truncate">{paper.firstAuthor || "Unknown"}</span>
                      <span>·</span>
                      <span className="shrink-0">{paper.year ?? "n.d."}</span>
                    </div>
                  </div>
                  <span
                    className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color, background: `${color}1A` }}
                  >
                    {statusLabel(paper.status)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
