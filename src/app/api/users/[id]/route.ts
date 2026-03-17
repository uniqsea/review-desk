import { NextResponse } from "next/server";
import { deleteUser, updateUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const user = await updateUser({
      userId: id,
      displayName: typeof body.displayName === "string" ? body.displayName : ""
    });
    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    const status = message.includes("already") ? 409 : message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
