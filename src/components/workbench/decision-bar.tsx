"use client";

type PaperStatus = "pending" | "included" | "excluded" | "uncertain";
import { formatTimestamp } from "@/lib/utils/time";

function statusLabel(status: Exclude<PaperStatus, "pending">) {
  if (status === "included") return "Included";
  if (status === "excluded") return "Excluded";
  return "Marked uncertain";
}

export function DecisionBar({
  paperStatus,
  reason,
  currentDecisionReason,
  currentDecisionTimestamp,
  onReasonChange,
  onInclude,
  onExclude,
  onUncertain,
  onUndo,
  isPending
}: {
  paperStatus: PaperStatus;
  reason: string;
  currentDecisionReason?: string | null;
  currentDecisionTimestamp?: string | null;
  onReasonChange: (value: string) => void;
  onInclude: () => void;
  onExclude: () => void;
  onUncertain: () => void;
  onUndo: () => void;
  isPending: boolean;
}) {
  const ACTIONS = [
    { key: "included" as const,  label: "Include",   color: "var(--included)", onClick: onInclude },
    { key: "excluded" as const,  label: "Exclude",   color: "var(--excluded)", onClick: onExclude },
    { key: "uncertain" as const, label: "Uncertain", color: "var(--pending)",  onClick: onUncertain },
  ];
  const reasonRequired = reason.trim().length === 0;

  // For decided papers, show the other two actions (re-categorise) + Undo
  const otherActions = paperStatus !== "pending"
    ? ACTIONS.filter((a) => a.key !== paperStatus)
    : ACTIONS;
  const isProcessed = paperStatus !== "pending";
  const currentReason = currentDecisionReason?.trim() || "";

  return (
    <div className="hairline-top bg-[var(--panel)] px-6 py-4">
      <div className="flex flex-col gap-2">
        {isProcessed ? (
          <div className="rounded-xl border px-4 py-3" style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)", background: "var(--panel-muted)" }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {statusLabel(paperStatus)}
            </div>
            <div className="mt-2 text-sm text-[var(--text)]">
              {currentReason || "No reason was recorded for this decision."}
            </div>
            {currentDecisionTimestamp ? (
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {formatTimestamp(currentDecisionTimestamp)}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={isProcessed ? "Optional note for re-categorising" : "Reason (required for exclusion)"}
            className="min-w-0 flex-1 rounded-xl border bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)]"
            style={{ borderWidth: "var(--hairline)", borderColor: !isProcessed && reasonRequired ? "var(--excluded)" : "var(--border)" }}
          />
          <div className="flex shrink-0 gap-2">
          {otherActions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={isPending || (a.key === "excluded" && reasonRequired)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: a.color }}
            >
              {a.label}
            </button>
          ))}
          {paperStatus !== "pending" && (
            <button
              type="button"
              onClick={onUndo}
              disabled={isPending}
              className="pill px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              Undo
            </button>
          )}
          </div>
        </div>
        {!isProcessed && reasonRequired ? (
          <div className="text-xs text-[var(--excluded)]">Exclude requires a reason.</div>
        ) : null}
      </div>
    </div>
  );
}
