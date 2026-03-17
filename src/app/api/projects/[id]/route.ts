import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectOwner } from "@/lib/access";
import { renameProject } from "@/lib/db/mutations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectOwner(id, user.userId);
    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await renameProject({
      projectId: id,
      name: body.name
    });

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rename project";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
