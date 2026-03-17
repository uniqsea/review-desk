import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { getCurrentReviewerSnapshot, getProjectSummary } from "@/lib/db/queries";
import { toCsv } from "@/lib/utils/export";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const mode = searchParams.get("mode") ?? "reviewer";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  await requireProjectMembership(projectId, user.userId);
  const rows =
    mode === "summary"
      ? (await getProjectSummary(projectId)).rows.map((row) => ({
          id: row.id,
          title: row.title,
          authorsText: row.authorsText,
          year: row.year,
          venue: row.venue,
          status: row.summaryStatus,
          reason: row.reviews.map((review) => `${review.reviewerName}: ${review.decision}${review.reason ? ` (${review.reason})` : ""}`).join(" | "),
          timestamp: row.reviews.map((review) => review.updatedAt).sort().at(-1) ?? null
        }))
      : (await getCurrentReviewerSnapshot(projectId, user.userId)).map((row) => ({
          ...row,
          status: row.status ?? "pending"
        }));
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="prisma-screening.csv"'
    }
  });
}
