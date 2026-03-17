"use client";

import type { StatsData } from "@/hooks/use-stats";

export function ProgressBar({ stats }: { stats?: StatsData }) {
  const included = stats?.percentages.included ?? 0;
  const excluded = stats?.percentages.excluded ?? 0;
  const pending = stats?.percentages.pending ?? 0;

  return (
    <div>
      <div className="flex overflow-hidden rounded-full" style={{ height: 10, background: "var(--panel-muted)" }}>
        <div style={{ width: `${included}%`, background: "var(--included)" }} />
        <div style={{ width: `${excluded}%`, background: "var(--excluded)" }} />
        <div style={{ width: `${pending}%`, background: "var(--pending)" }} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-[var(--text-muted)]">
        <span>Included {included}%</span>
        <span>Excluded {excluded}%</span>
        <span>Pending {pending}%</span>
      </div>
    </div>
  );
}
