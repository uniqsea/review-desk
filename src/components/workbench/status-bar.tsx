"use client";

import type { StatsData } from "@/hooks/use-stats";

function StatPill({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="pill flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export function StatusBar({ stats }: { stats?: StatsData }) {
  return (
    <div className="flex gap-2">
      <StatPill label="Total" value={stats?.total ?? 0} color="var(--text)" />
      <StatPill label="In" value={stats?.included ?? 0} color="var(--included)" />
      <StatPill label="Out" value={stats?.excluded ?? 0} color="var(--excluded)" />
      <StatPill label="Pending" value={stats?.pending ?? 0} color="var(--pending)" />
    </div>
  );
}
