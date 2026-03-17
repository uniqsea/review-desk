import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/auth";

export async function GET() {
  const users = await listUsers();
  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt
    }))
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }

    const user = await createUser({
      displayName: body.displayName
    });

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
