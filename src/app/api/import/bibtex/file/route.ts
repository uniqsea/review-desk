import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { importBibtexInput } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = formData.get("mode") === "new_project" ? "new_project" : "existing_project";
    const projectId = typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) : null;
    const projectName = typeof formData.get("projectName") === "string" ? String(formData.get("projectName")) : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "BibTeX file is required" }, { status: 400 });
    }

    if (mode === "existing_project" && projectId) {
      await requireProjectMembership(projectId, user.userId);
    }

    const text = await file.text();
    const result = await importBibtexInput({
      userId: user.userId,
      rawInput: text,
      sourceType: "file",
      filename: file.name,
      mode,
      projectId,
      projectName
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import BibTeX file" },
      { status: 500 }
    );
  }
}
