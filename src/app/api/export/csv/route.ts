import { NextResponse } from "next/server";
import { getCurrentDecisionSnapshot } from "@/lib/db/queries";
import { toCsv } from "@/lib/utils/export";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const rows = await getCurrentDecisionSnapshot(projectId);
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="prisma-screening.csv"'
    }
  });
}
