import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { previewImport } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const contentType = request.headers.get("content-type") ?? "";
    let rawInput: string;
    let sourceType: "file" | "text";
    let filename: string | null = null;
    let mode: "new_project" | "existing_project";
    let projectId: string | null = null;
    let projectName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "BibTeX file is required" }, { status: 400 });
      }
      rawInput = await file.text();
      sourceType = "file";
      filename = file.name;
      mode = formData.get("mode") === "new_project" ? "new_project" : "existing_project";
      projectId = typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) : null;
      projectName = typeof formData.get("projectName") === "string" ? String(formData.get("projectName")) : null;
    } else {
      const body = await request.json();
      if (!body.text) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }
      rawInput = body.text;
      sourceType = "text";
      mode = body.mode === "new_project" ? "new_project" : "existing_project";
      projectId = typeof body.projectId === "string" ? body.projectId : null;
      projectName = typeof body.projectName === "string" ? body.projectName : null;
    }

    if (mode === "existing_project" && projectId) {
      await requireProjectMembership(projectId, user.userId);
    }

    const preview = await previewImport({ rawInput, sourceType, filename, mode, projectId, projectName });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}
