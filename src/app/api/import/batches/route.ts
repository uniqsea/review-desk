import { NextResponse } from "next/server";
import { getImportBatches, getImportDuplicateLogsForBatch } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  if (batchId) {
    const duplicates = await getImportDuplicateLogsForBatch(batchId, projectId);
    return NextResponse.json({ duplicates });
  }

  const batches = await getImportBatches(projectId);
  return NextResponse.json({ batches });
}
