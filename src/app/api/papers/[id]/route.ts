import { NextResponse } from "next/server";
import { getPaperById } from "@/lib/db/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const paper = await getPaperById(id, projectId);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({ paper });
}
