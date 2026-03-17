import { NextResponse } from "next/server";
import { previewImport } from "@/lib/db/mutations";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let rawInput: string;
    let sourceType: "file" | "text";
    let filename: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "BibTeX file is required" }, { status: 400 });
      }
      rawInput = await file.text();
      sourceType = "file";
      filename = file.name;
    } else {
      const body = await request.json();
      if (!body.text) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }
      rawInput = body.text;
      sourceType = "text";
    }

    const preview = await previewImport({ rawInput, sourceType, filename });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}
