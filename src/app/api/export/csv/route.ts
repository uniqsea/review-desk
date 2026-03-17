import { NextResponse } from "next/server";
import { getCurrentDecisionSnapshot } from "@/lib/db/queries";
import { toCsv } from "@/lib/utils/export";

export async function GET() {
  const rows = await getCurrentDecisionSnapshot();
  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="prisma-screening.csv"'
    }
  });
}
