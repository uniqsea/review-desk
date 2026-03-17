import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { getIncludedBibEntries } from "@/lib/db/queries";
import { toIncludedBib } from "@/lib/utils/export";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  await requireProjectMembership(projectId, user.userId);
  const rows = await getIncludedBibEntries(projectId);
  const content = toIncludedBib(rows.map((row) => row.rawBibtex));

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/x-bibtex; charset=utf-8",
      "Content-Disposition": 'attachment; filename="included.bib"'
    }
  });
}
