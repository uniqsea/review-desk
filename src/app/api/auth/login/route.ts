import { NextResponse } from "next/server";
import { loginWithUserId } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.userId !== "string" || !body.userId.trim()) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await loginWithUserId(body.userId);
    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to login";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
