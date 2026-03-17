import { NextResponse } from "next/server";
import { listPapers } from "@/lib/db/queries";
import { paperQuerySchema } from "@/lib/validators/paper";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = paperQuerySchema.safeParse({
    status: searchParams.get("status") ?? "all",
    q: searchParams.get("q") ?? ""
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const papers = await listPapers(parsed.data.status, parsed.data.q);
  return NextResponse.json({ papers });
}
