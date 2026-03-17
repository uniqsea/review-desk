import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { createDecision } from "@/lib/db/mutations";
import { decisionSchema } from "@/lib/validators/decision";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const parsed = decisionSchema.safeParse(body);

    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const message =
        flattened.fieldErrors.reason?.[0] ??
        flattened.formErrors[0] ??
        "Invalid decision payload";
      return NextResponse.json({ error: message, details: flattened }, { status: 400 });
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    await requireProjectMembership(projectId, user.userId);

    const result = await createDecision({
      paperId: id,
      reviewerId: user.userId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
      projectId
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save decision" },
      { status: 500 }
    );
  }
}
