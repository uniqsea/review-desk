import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { getDecisionLogs } from "@/lib/db/queries";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  await requireProjectMembership(projectId, user.userId);
  const decisions = await getDecisionLogs(projectId, user.userId);
  return NextResponse.json({ decisions });
}
