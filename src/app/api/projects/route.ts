import { NextResponse } from "next/server";
import { createProject } from "@/lib/db/mutations";
import { getProjects } from "@/lib/db/queries";

export async function GET() {
  const projects = await getProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await createProject({
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
