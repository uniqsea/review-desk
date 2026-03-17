import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { getImportBatches, getImportDuplicateLogsForBatch } from "@/lib/db/queries";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  await requireProjectMembership(projectId, user.userId);

  if (batchId) {
    const duplicates = await getImportDuplicateLogsForBatch(batchId, projectId);
    return NextResponse.json({ duplicates });
  }

  const batches = await getImportBatches(projectId);
  return NextResponse.json({ batches });
}
