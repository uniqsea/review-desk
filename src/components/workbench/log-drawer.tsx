"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimestamp } from "@/lib/utils/time";
import type { DecisionLogItem } from "@/hooks/use-decision-log";
import type { ImportBatch, ImportDuplicateLog } from "@/hooks/use-import-log";
import { useImportBatchDuplicates } from "@/hooks/use-import-log";

type Tab = "decisions" | "imports";

function describeDecisionOperation(decision: DecisionLogItem) {
  if (decision.kind === "undo") {
    return `Undo to ${decision.toStatus}`;
  }

  if (decision.toStatus === "included") {
    return "Included";
  }

  if (decision.toStatus === "excluded") {
    return "Excluded";
  }

  if (decision.toStatus === "uncertain") {
    return "Marked uncertain";
  }

  return `${decision.fromStatus} -> ${decision.toStatus}`;
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
          {dup.existingPaperTitle
            ? ` · existing: ${dup.existingPaperTitle.slice(0, 30)}${dup.existingPaperTitle.length > 30 ? "…" : ""}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch }: { batch: ImportBatch }) {
  const [expanded, setExpanded] = useState(false);
  const dupQuery = useImportBatchDuplicates(batch.projectId, expanded && batch.duplicateCount > 0 ? batch.id : null);
  const imported = batch.parsedCount - batch.skippedCount;
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
            <span className="text-xs" style={{ color: "var(--included)" }}>+{imported} imported</span>
            {batch.skippedCount > 0 && <span className="text-xs text-[var(--text-muted)]">{batch.skippedCount} skipped</span>}
            {batch.failedCount > 0 && <span className="text-xs text-[var(--text-muted)]">{batch.failedCount} failed</span>}
            {batch.duplicateCount > 0 && <span className="text-xs" style={{ color: "var(--pending)" }}>{batch.duplicateCount} dup</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="text-xs text-[var(--text-muted)]">{formatTimestamp(batch.createdAt)}</div>
          {batch.duplicateCount > 0 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="pill px-2 py-0.5 text-xs">
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

export function LogDrawer({
  open,
  onClose,
  decisions,
  importBatches
}: {
  open: boolean;
  onClose: () => void;
  decisions: DecisionLogItem[];
  importBatches: ImportBatch[];
}) {
  const [tab, setTab] = useState<Tab>("decisions");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.25)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none"
        }}
      />

      <div
        className="fixed top-0 right-0 z-50 flex h-full w-[420px] flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: "var(--panel)",
          transform: open ? "translateX(0)" : "translateX(100%)"
        }}
      >
        <div className="hairline-bottom flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Activity Log</span>
            <div className="flex gap-1 rounded-xl bg-[var(--panel-muted)] p-0.5">
              <button
                type="button"
                onClick={() => setTab("decisions")}
                className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                style={tab === "decisions"
                  ? { background: "var(--panel)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "var(--text-muted)" }}
              >
                Decisions
                {decisions.length > 0 && (
                  <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                    {decisions.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("imports")}
                className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                style={tab === "imports"
                  ? { background: "var(--panel)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "var(--text-muted)" }}
              >
                Imports
                {importBatches.length > 0 && (
                  <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                    {importBatches.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {tab === "decisions" && (
            decisions.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                style={{ borderWidth: "var(--hairline)" }}>
                No decisions yet.
              </div>
            ) : (
              decisions.map((d) => {
                const isUndo = d.kind === "undo";
                const color = isUndo ? "var(--text-muted)" : d.isActive ? "var(--included)" : "var(--text-muted)";
                const badge = isUndo ? "undo" : d.isActive ? (d.targetDecisionId ? "" : "decided") : "overridden";
                return (
                  <div
                    key={d.id}
                    className="rounded-xl border px-3 py-3"
                    style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)", borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="line-clamp-2 text-xs font-medium leading-4 min-w-0">{d.title}</div>
                      {badge && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{ background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {describeDecisionOperation(d)}
                    </div>
                    {d.reason ? (
                      <div className="mt-1.5 line-clamp-1 text-xs text-[var(--text-muted)]">{d.reason}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      {d.userDisplayName} • {formatTimestamp(d.createdAt)}
                    </div>
                  </div>
                );
              })
            )
          )}

          {tab === "imports" && (
            importBatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                style={{ borderWidth: "var(--hairline)" }}>
                No imports yet.
              </div>
            ) : (
              importBatches.map((b) => <BatchCard key={b.id} batch={b} />)
            )
          )}
        </div>
      </div>
    </>
  );
}
