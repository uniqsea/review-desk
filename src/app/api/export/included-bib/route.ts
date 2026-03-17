import { NextResponse } from "next/server";
import { getIncludedBibEntries } from "@/lib/db/queries";
import { toIncludedBib } from "@/lib/utils/export";

export async function GET() {
  const rows = await getIncludedBibEntries();
  const content = toIncludedBib(rows.map((row) => row.rawBibtex));

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/x-bibtex; charset=utf-8",
      "Content-Disposition": 'attachment; filename="included.bib"'
    }
  });
}
