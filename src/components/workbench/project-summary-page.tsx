"use client";

import Link from "next/link";
import { AuthScreen } from "@/components/auth/auth-screen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useProjectSummary } from "@/hooks/use-project-summary";

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

        <section className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--panel-muted)] text-left text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Paper</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reviewer Decisions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hairline-top align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium">{row.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {row.authorsText || "Unknown authors"}
                        {row.year ? ` · ${row.year}` : ""}
                        {row.venue ? ` · ${row.venue}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ color: statusColor(row.summaryStatus), background: `${statusColor(row.summaryStatus)}1A` }}
                      >
                        {statusLabel(row.summaryStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {row.reviews.length === 0 ? (
                          <div className="text-xs text-[var(--text-muted)]">No reviewer decisions yet.</div>
                        ) : (
                          row.reviews.map((review) => (
                            <div key={review.id} className="rounded-xl border px-3 py-2" style={{ borderWidth: "var(--hairline)", borderColor: "var(--border)" }}>
                              <div className="text-xs font-semibold">{review.reviewerName}</div>
                              <div className="mt-1 text-sm capitalize">{review.decision}</div>
                              {review.reason ? <div className="mt-1 text-xs text-[var(--text-muted)]">{review.reason}</div> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
