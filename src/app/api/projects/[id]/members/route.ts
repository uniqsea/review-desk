import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectMembership, requireProjectOwner } from "@/lib/access";
import { addProjectMemberByUserId } from "@/lib/db/mutations";
import { getProjectMembers } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectMembership(id, user.userId);
    const members = await getProjectMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectOwner(id, user.userId);
    const body = await request.json();
    if (typeof body.userId !== "string" || !body.userId.trim()) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    await addProjectMemberByUserId(id, body.userId);
    const members = await getProjectMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add member";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
