import { NextResponse } from "next/server";
import { undoDecisionById } from "@/lib/db/mutations";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await undoDecisionById(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo decision";
    const status = message.includes("cannot") || message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
