"use client";

import type { PaperDetailData } from "@/hooks/use-paper-detail";
import { DecisionBar } from "./decision-bar";

function toDoiUrl(doi: string) {
  const trimmed = doi.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^doi:\s*/i, "");
  return `https://doi.org/${normalized}`;
}

function Keywords({ keywordsText }: { keywordsText: string | null }) {
  const keywords = (keywordsText ?? "")
    .split(/[,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    return <div className="text-sm text-[var(--text-muted)]">No keywords available.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((kw) => (
        <span key={kw} className="pill px-3 py-1 text-xs text-[var(--text-muted)]">
          {kw}
        </span>
      ))}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "var(--pending)" },
  included: { label: "Included", color: "var(--included)" },
  excluded: { label: "Excluded", color: "var(--excluded)" },
  uncertain: { label: "Uncertain", color: "var(--pending)" }
};

export function PaperDetail({
  paper,
  reason,
  onReasonChange,
  onInclude,
  onExclude,
  onUncertain,
  onUndo,
  isMutating
}: {
  paper?: PaperDetailData;
  reason: string;
  onReasonChange: (value: string) => void;
  onInclude: () => void;
  onExclude: () => void;
  onUncertain: () => void;
  onUndo: () => void;
  isMutating: boolean;
}) {
  if (!paper) {
    return (
      <div className="panel flex h-full min-h-0 items-center justify-center px-8 text-center text-sm text-[var(--text-muted)]">
        Import a BibTeX file or select a paper to start screening.
      </div>
    );
  }

  const meta = STATUS_META[paper.status] ?? STATUS_META.pending;
  const doiUrl = paper.doi ? toDoiUrl(paper.doi) : null;

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: meta.color, background: `${meta.color}1A` }}
          >
            {meta.label}
          </span>
          {paper.year ? <span className="text-xs text-[var(--text-muted)]">{paper.year}</span> : null}
          {paper.year && paper.venue ? <span className="text-xs text-[var(--text-muted)]">·</span> : null}
          {paper.venue ? <span className="truncate text-xs text-[var(--text-muted)]">{paper.venue}</span> : null}
        </div>

        <h1 className="text-[1.4rem] font-semibold leading-snug">{paper.title}</h1>
        <div className="mt-3 text-sm text-[var(--text-muted)]">{paper.authorsText || "Unknown authors"}</div>
        {paper.doi ? (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            DOI:{" "}
            <a
              href={doiUrl ?? paper.doi}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-[0.5px] underline-offset-4 hover:text-[var(--text)]"
            >
              {paper.doi}
            </a>
          </div>
        ) : null}

        <section className="mt-7">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Abstract</h2>
          <p className="whitespace-pre-wrap text-sm leading-[1.85] text-[var(--text)]">
            {paper.abstract || "No abstract available."}
          </p>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Keywords</h2>
          <Keywords keywordsText={paper.keywordsText} />
        </section>
      </div>

      <DecisionBar
        paperStatus={(paper.status as "pending" | "included" | "excluded" | "uncertain") ?? "pending"}
        reason={reason}
        currentDecisionReason={paper.latestDecisionReason}
        currentDecisionTimestamp={paper.latestDecisionTimestamp}
        onReasonChange={onReasonChange}
        onInclude={onInclude}
        onExclude={onExclude}
        onUncertain={onUncertain}
        onUndo={onUndo}
        isPending={isMutating}
      />
    </div>
  );
}
