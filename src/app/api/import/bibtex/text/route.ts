import { NextResponse } from "next/server";
import { importBibtexInput } from "@/lib/db/mutations";
import { importTextSchema } from "@/lib/validators/import";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = importTextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await importBibtexInput({
      rawInput: parsed.data.text,
      sourceType: "text"
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import BibTeX text" },
      { status: 500 }
    );
  }
}
