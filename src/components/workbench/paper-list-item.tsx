"use client";

import clsx from "clsx";
import type { PaperListItemData } from "@/hooks/use-papers";

export function PaperListItem({
  paper,
  selected,
  onClick
}: {
  paper: PaperListItemData;
  selected: boolean;
  onClick: () => void;
}) {
  const borderColor =
    paper.status === "included"
      ? "var(--included)"
      : paper.status === "excluded"
        ? "var(--excluded)"
        : "var(--pending)";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
        selected ? "bg-[var(--panel-muted)]" : "bg-transparent hover:bg-[var(--panel-muted)]/60"
      )}
      style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)", borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <div className="line-clamp-2 text-sm font-medium leading-5">{paper.title}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span className="truncate">{paper.firstAuthor || "Unknown"}</span>
        <span>·</span>
        <span className="shrink-0">{paper.year ?? "n.d."}</span>
      </div>
    </button>
  );
}
