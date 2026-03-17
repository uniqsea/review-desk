import { NextResponse } from "next/server";
import { importBibtexInput } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "BibTeX file is required" }, { status: 400 });
    }

    const text = await file.text();
    const result = await importBibtexInput({
      rawInput: text,
      sourceType: "file",
      filename: file.name
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import BibTeX file" },
      { status: 500 }
    );
  }
}
