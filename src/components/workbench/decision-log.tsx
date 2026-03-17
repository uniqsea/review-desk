"use client";

import { useState } from "react";
import { formatTimestamp } from "@/lib/utils/time";
import type { DecisionLogItem } from "@/hooks/use-decision-log";
import type { ImportBatch, ImportDuplicateLog } from "@/hooks/use-import-log";
import { useImportBatchDuplicates } from "@/hooks/use-import-log";
import type { StatsData } from "@/hooks/use-stats";
import { ProgressBar } from "./progress-bar";

type Tab = "decisions" | "imports";

function ImportedCount({ n, label }: { n: number; label: string }) {
  if (n === 0) return null;
  return <span className="text-xs text-[var(--text-muted)]">{n} {label}</span>;
}

function BatchDuplicateRow({ dup }: { dup: ImportDuplicateLog }) {
  const isForced = dup.action === "force_imported";
  const color = isForced ? "var(--accent)" : "var(--text-muted)";
  return (
    <div className="flex items-start gap-2 py-1.5 hairline-bottom last:border-0">
      <span className="mt-0.5 text-xs" style={{ color }}>{isForced ? "↑" : "⊘"}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{dup.newTitle}</div>
        <div className="text-xs text-[var(--text-muted)]">
          matched by <span className="font-semibold">{dup.matchReason}</span>
          {dup.existingPaperTitle ? ` · existing: ${dup.existingPaperTitle.slice(0, 30)}${dup.existingPaperTitle.length > 30 ? "…" : ""}` : ""}
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch }: { batch: ImportBatch }) {
  const [expanded, setExpanded] = useState(false);
  const dupQuery = useImportBatchDuplicates(batch.projectId, expanded && batch.duplicateCount > 0 ? batch.id : null);

  const importedCount = batch.parsedCount - batch.skippedCount;
  const label = batch.sourceType === "file" && batch.filename ? batch.filename : "pasted text";

  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)", borderLeftWidth: 3, borderLeftColor: "var(--accent)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{label}</div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-xs" style={{ color: "var(--included)" }}>+{importedCount} imported</span>
            <ImportedCount n={batch.skippedCount} label="skipped" />
            <ImportedCount n={batch.failedCount} label="failed" />
            {batch.duplicateCount > 0 && (
              <span className="text-xs text-[var(--pending)]">{batch.duplicateCount} dup</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="text-xs text-[var(--text-muted)]">{formatTimestamp(batch.createdAt)}</div>
          {batch.duplicateCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="pill px-2 py-0.5 text-xs"
            >
              {expanded ? "hide" : "details"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)", borderWidth: "var(--hairline)" }}>
          {dupQuery.isLoading ? (
            <div className="py-2 text-xs text-[var(--text-muted)]">Loading…</div>
          ) : dupQuery.data?.duplicates.length ? (
            dupQuery.data.duplicates.map((dup) => <BatchDuplicateRow key={dup.id} dup={dup} />)
          ) : (
            <div className="py-2 text-xs text-[var(--text-muted)]">No duplicate details.</div>
          )}
        </div>
      )}
    </div>
  );
}

export function DecisionLog({
  decisions,
  importBatches,
  stats,
  onUndo,
  collapsed,
  onToggle
}: {
  decisions: DecisionLogItem[];
  importBatches?: ImportBatch[];
  stats?: StatsData;
  onUndo: (decisionId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [tab, setTab] = useState<Tab>("decisions");
  const batches = importBatches ?? [];

  if (collapsed) {
    return (
      <div className="panel flex h-full w-10 flex-col items-center justify-between py-4">
        <button type="button" onClick={onToggle} className="pill px-2 py-1 text-xs text-[var(--text-muted)]">
          ›
        </button>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <span className="text-xs font-semibold tracking-widest text-[var(--text-muted)] select-none uppercase">
            Activity Log
          </span>
        </div>
        <div className="w-6" />
      </div>
    );
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="hairline-bottom flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("decisions")}
            className="rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
            style={tab === "decisions"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--text-muted)" }}
          >
            Decisions
            {decisions.length > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                style={tab === "decisions"
                  ? { background: "rgba(255,255,255,0.25)" }
                  : { background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                {decisions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("imports")}
            className="rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
            style={tab === "imports"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--text-muted)" }}
          >
            Imports
            {batches.length > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                style={tab === "imports"
                  ? { background: "rgba(255,255,255,0.25)" }
                  : { background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                {batches.length}
              </span>
            )}
          </button>
        </div>
        <button type="button" onClick={onToggle} className="pill px-3 py-1 text-xs text-[var(--text-muted)]">
          ‹ Hide
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {tab === "decisions" && (
          decisions.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]" style={{ borderWidth: "var(--hairline)" }}>
              No decisions yet.
            </div>
          ) : (
            decisions.map((decision) => {
              const accentColor = decision.kind === "undo" ? "var(--text-muted)" : decision.isActive ? "var(--included)" : "var(--excluded)";
              return (
                <div
                  key={decision.id}
                  className="rounded-xl border px-3 py-3"
                  style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)", borderLeftWidth: 3, borderLeftColor: accentColor }}
                >
                  <div className="line-clamp-2 text-xs font-medium leading-4">{decision.title}</div>
                  {decision.reason ? (
                    <div className="mt-1.5 text-xs text-[var(--text-muted)] line-clamp-1">{decision.reason}</div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-[var(--text-muted)]">
                      {formatTimestamp(decision.createdAt)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onUndo(decision.id)}
                      disabled={!decision.isActive || decision.kind !== "decision"}
                      className="pill px-2.5 py-0.5 text-xs disabled:opacity-40"
                    >
                      ↩
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {tab === "imports" && (
          batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]" style={{ borderWidth: "var(--hairline)" }}>
              No imports yet.
            </div>
          ) : (
            batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)
          )
        )}
      </div>

      <div className="hairline-top px-4 py-4">
        <ProgressBar stats={stats} />
      </div>
    </div>
  );
}
