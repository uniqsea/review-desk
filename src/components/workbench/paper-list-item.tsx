"use client";

import clsx from "clsx";
import type { PaperListItemData } from "@/hooks/use-papers";

const STATUS_CONFIG = {
  included: {
    color: "var(--included)",
    label: "In",
    bg: "rgba(22,163,74,0.08)",
    text: "var(--included)",
  },
  excluded: {
    color: "var(--excluded)",
    label: "Out",
    bg: "rgba(220,38,38,0.08)",
    text: "var(--excluded)",
  },
  pending: {
    color: "var(--pending)",
    label: null,
    bg: null,
    text: null,
  },
} as const;

export function PaperListItem({
  paper,
  selected,
  onClick
}: {
  paper: PaperListItemData;
  selected: boolean;
  onClick: () => void;
}) {
  const status = (paper.status ?? "pending") as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group w-full rounded-xl text-left transition-all duration-150",
        selected
          ? "bg-[var(--panel-muted)] shadow-sm"
          : "bg-transparent hover:bg-[var(--panel-muted)]/60"
      )}
      style={{
        border: "var(--hairline) solid var(--border)",
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
        padding: "10px 14px",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="line-clamp-2 text-sm font-medium leading-5 flex-1">{paper.title}</div>
        {cfg.label && (
          <span
            className="shrink-0 mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide"
            style={{ background: cfg.bg!, color: cfg.text! }}
          >
            {cfg.label}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span className="truncate">{paper.firstAuthor || "Unknown"}</span>
        <span className="opacity-40">·</span>
        <span className="shrink-0 tabular-nums">{paper.year ?? "n.d."}</span>
      </div>
    </button>
  );
}
