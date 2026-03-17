import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { undoDecisionById } from "@/lib/db/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.projectId !== "string" || !body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    const result = await undoDecisionById({ decisionId: id, reviewerId: user.userId, projectId: body.projectId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo decision";
    const status = message.includes("cannot") || message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
