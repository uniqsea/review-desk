import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireProjectOwner } from "@/lib/access";
import { removeProjectMember } from "@/lib/db/mutations";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const currentUser = await requireUser();
    const { id, userId } = await params;
    await requireProjectOwner(id, currentUser.userId);
    await removeProjectMember(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
