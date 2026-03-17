import { NextResponse } from "next/server";
import { undoLatestDecisionForPaper } from "@/lib/db/mutations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await undoLatestDecisionForPaper(id, typeof body.projectId === "string" ? body.projectId : undefined);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo decision";
    const status = message === "No active decision to undo" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
