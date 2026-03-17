import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { importBibtexInput } from "@/lib/db/mutations";
import { importTextSchema } from "@/lib/validators/import";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = importTextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (body.mode !== "new_project" && typeof body.projectId === "string" && body.projectId) {
      await requireProjectMembership(body.projectId, user.userId);
    }

    const result = await importBibtexInput({
      userId: user.userId,
      rawInput: parsed.data.text,
      sourceType: "text",
      mode: body.mode === "new_project" ? "new_project" : "existing_project",
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      projectName: typeof body.projectName === "string" ? body.projectName : null
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import BibTeX text" },
      { status: 500 }
    );
  }
}
