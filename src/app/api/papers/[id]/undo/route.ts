import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { undoLatestDecisionForPaper } from "@/lib/db/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    await requireProjectMembership(projectId, user.userId);
    const result = await undoLatestDecisionForPaper({
      paperId: id,
      reviewerId: user.userId,
      projectId
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo decision";
    const status = message === "No active decision to undo" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
