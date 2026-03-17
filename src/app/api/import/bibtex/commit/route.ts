import { NextResponse } from "next/server";
import { commitImport } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { batchToken, forceEntryIndices = [] } = body;
    if (!batchToken) {
      return NextResponse.json({ error: "batchToken is required" }, { status: 400 });
    }
    const result = await commitImport({ batchToken, forceEntryIndices });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commit failed" },
      { status: 500 }
    );
  }
}
