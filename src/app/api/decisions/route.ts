import { NextResponse } from "next/server";
import { getDecisionLogs } from "@/lib/db/queries";

export async function GET() {
  const decisions = await getDecisionLogs();
  return NextResponse.json({ decisions });
}
