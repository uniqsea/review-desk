import { NextResponse } from "next/server";
import { getImportBatches, getImportDuplicateLogsForBatch } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  if (batchId) {
    const duplicates = await getImportDuplicateLogsForBatch(batchId);
    return NextResponse.json({ duplicates });
  }

  const batches = await getImportBatches();
  return NextResponse.json({ batches });
}
