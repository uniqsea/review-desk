import { NextResponse } from "next/server";
import { getStats } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const stats = await getStats(projectId);
  return NextResponse.json({ stats });
}
