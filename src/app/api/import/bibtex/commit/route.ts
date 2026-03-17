import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { commitImport } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { batchToken, forceEntryIndices = [] } = body;
    if (!batchToken) {
      return NextResponse.json({ error: "batchToken is required" }, { status: 400 });
    }
    const result = await commitImport({ userId: user.userId, batchToken, forceEntryIndices });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commit failed" },
      { status: 500 }
    );
  }
}
