import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createProject } from "@/lib/db/mutations";
import { getProjectsForUser } from "@/lib/db/queries";

export async function GET() {
  const user = await requireUser();
  const projects = await getProjectsForUser(user.userId);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await createProject({
      userId: user.userId,
      name: body.name,
      description: typeof body.description === "string" ? body.description : null
    });

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 500 }
    );
  }
}
