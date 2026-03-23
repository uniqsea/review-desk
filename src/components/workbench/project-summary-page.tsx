"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AuthScreen } from "@/components/auth/auth-screen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useProjectSummary, type SummaryPaperRow } from "@/hooks/use-project-summary";
import { YearBarChart } from "@/components/workbench/year-bar-chart";
import { ResultDonutChart } from "@/components/workbench/result-donut-chart";

function statusLabel(status: string) {
  switch (status) {
    case "unreviewed":
      return "Unreviewed";
    case "partially_reviewed":
      return "Partially reviewed";
    case "agreement_include":
      return "Agreement: Include";
    case "agreement_exclude":
      return "Agreement: Exclude";
    case "agreement_uncertain":
      return "Agreement: Uncertain";
    default:
      return "Conflict";
  }
}

function statusColor(status: string) {
  if (status === "agreement_include") return "var(--included)";
  if (status === "agreement_exclude" || status === "conflict") return "var(--excluded)";
  return "var(--pending)";
}

export function ProjectSummaryPage({ projectId }: { projectId: string }) {
  const currentUserQuery = useCurrentUser();
  const summaryQuery = useProjectSummary(projectId);

  if (currentUserQuery.isLoading) {
    return <main className="app-shell flex min-h-screen items-center justify-center">Loading…</main>;
  }

  if (!currentUserQuery.data?.user) {
    return <AuthScreen />;
  }

  if (summaryQuery.isLoading) {
    return <main className="app-shell flex min-h-screen items-center justify-center">Loading summary…</main>;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <main className="app-shell flex min-h-screen items-center justify-center">Failed to load summary.</main>;
  }

  const { rows, stats, members } = summaryQuery.data;

  return (
    <main className="app-shell min-h-screen px-5 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        {/* Header */}
        <section className="panel px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Project Summary</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Reviewer Agreement Overview</h1>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="pill px-4 py-2 text-sm font-medium">
                Back to Workspace
              </Link>
              <button
                type="button"
                onClick={() => window.open(`/api/export/csv?projectId=${projectId}&mode=summary`, "_blank")}
                className="pill px-4 py-2 text-sm font-medium"
              >
                Export Summary CSV
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>{stats.total} papers</span>
            <span className="text-[var(--pending)]">{stats.unreviewed} unreviewed</span>
            <span className="text-[var(--pending)]">{stats.partiallyReviewed} partial</span>
            <span className="text-[var(--included)]">{stats.agreements} agreements</span>
            <span className="text-[var(--excluded)]">{stats.conflicts} conflicts</span>
          </div>

          <div className="mt-3 text-sm text-[var(--text-muted)]">
            Reviewers: {members.map((member) => member.displayName).join(", ")}
          </div>
        </section>

        {/* Charts */}
        <ChartsSection rows={rows} stats={stats} projectId={projectId} />

        {/* Paper list */}
        <section className="panel overflow-hidden">
          {/* List header */}
          <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Papers · {rows.length}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {rows.map((row, idx) => (
              <PaperRow key={row.id} row={row} index={idx} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

// ── Charts Section ────────────────────────────────────────────────────────────

function ChartsSection({
  rows,
  stats,
}: {
  rows: ReturnType<typeof useProjectSummary>["data"] extends infer D ? D extends { rows: infer R } ? R : never : never;
  stats: ReturnType<typeof useProjectSummary>["data"] extends infer D ? D extends { stats: infer S } ? S : never : never;
  projectId: string;
}) {
  const yearData = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of rows) {
      if (row.year) map.set(row.year, (map.get(row.year) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const resultData = useMemo(
    () => ({
      include:    rows.filter((r) => r.summaryStatus === "agreement_include").length,
      exclude:    rows.filter((r) => r.summaryStatus === "agreement_exclude").length,
      uncertain:  rows.filter((r) => r.summaryStatus === "agreement_uncertain").length,
      conflict:   stats.conflicts,
      partial:    stats.partiallyReviewed,
      unreviewed: stats.unreviewed,
    }),
    [rows, stats],
  );

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* Year distribution */}
      <section className="panel px-6 py-5">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Publication Year</div>
          <h2 className="mt-0.5 text-sm font-semibold">Papers by Year</h2>
        </div>
        <YearBarChart data={yearData} />
      </section>

      {/* Screening result */}
      <section className="panel px-6 py-5">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Screening Results</div>
          <h2 className="mt-0.5 text-sm font-semibold">Decision Breakdown</h2>
        </div>
        <ResultDonutChart data={resultData} />
      </section>
    </div>
  );
}

// ── PaperRow ──────────────────────────────────────────────────────────────────

function decisionColor(decision: string) {
  if (decision === "included") return "var(--included)";
  if (decision === "excluded") return "var(--excluded)";
  return "#f59e0b"; // uncertain
}

function PaperRow({
  row,
  index,
}: {
  row: SummaryPaperRow;
  index: number;
}) {
  const color = statusColor(row.summaryStatus);

  return (
    <div className="flex gap-0 transition-colors hover:bg-[var(--panel-muted)]">
      {/* Left accent bar */}
      <div className="w-1 flex-shrink-0 rounded-l" style={{ background: color, opacity: 0.7 }} />

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-6">

        {/* Index + title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0 text-[11px] tabular-nums text-[var(--text-muted)] opacity-50 select-none">
              {String(index + 1).padStart(3, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{row.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                {row.authorsText && (
                  <span className="truncate max-w-xs">{row.authorsText}</span>
                )}
                {row.year && (
                  <span className="flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--panel-muted)", color: "var(--text-muted)" }}>
                    {row.year}
                  </span>
                )}
                {row.venue && (
                  <span className="truncate italic">{row.venue}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: status + decisions */}
        <div className="flex flex-shrink-0 flex-col items-end gap-3 sm:min-w-[220px] sm:items-end">
          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ color, background: `${color}18` }}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {statusLabel(row.summaryStatus)}
          </span>

          {/* Reviewer decision chips */}
          {row.reviews.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {row.reviews.map((review) => {
                const dc = decisionColor(review.decision);
                return (
                  <div
                    key={review.id}
                    className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]"
                    style={{ background: `${dc}12`, border: `1px solid ${dc}30` }}
                    title={review.reason ?? undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: dc }} />
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{review.reviewerName}</span>
                    <span className="capitalize" style={{ color: dc }}>{review.decision}</span>
                    {review.reason && (
                      <span className="ml-0.5 text-[var(--text-muted)] opacity-60">· {review.reason}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {row.reviews.length === 0 && (
            <span className="text-[11px] text-[var(--text-muted)] opacity-50">No decisions yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
