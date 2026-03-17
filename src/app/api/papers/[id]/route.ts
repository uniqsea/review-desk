import { NextResponse } from "next/server";
import { getPaperById } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPaperById(id);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({ paper });
}
