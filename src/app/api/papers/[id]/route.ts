import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership } from "@/lib/access";
import { getPaperById } from "@/lib/db/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  await requireProjectMembership(projectId, user.userId);
  const paper = await getPaperById(id, projectId, user.userId);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({ paper });
}
