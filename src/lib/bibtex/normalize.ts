import type { ParsedBibtexEntry } from "./parse";

export interface NormalizedPaperInput {
  bibtexKey: string;
  rawBibtex: string;
  title: string;
  authorsText: string;
  firstAuthor: string;
  year: number | null;
  venue: string;
  abstract: string;
  keywordsText: string;
  doi: string;
}

function cleanValue(value?: string) {
  return (value ?? "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function getFirstAuthor(authorsText: string) {
  const [firstAuthor] = authorsText.split(/\s+and\s+/i).map((part) => part.trim());
  if (!firstAuthor) {
    return "Unknown";
  }
  const commaParts = firstAuthor.split(",").map((part) => part.trim()).filter(Boolean);
  return commaParts.length > 0 ? commaParts[0] : firstAuthor;
}

export function normalizeBibtexEntry(entry: ParsedBibtexEntry) {
  const title = cleanValue(entry.fields.title);

  if (!title) {
    return {
      ok: false as const,
      error: "Missing title"
    };
  }

  const authorsText = cleanValue(entry.fields.author) || "Unknown";
  const venue = [
    entry.fields.journal,
    entry.fields.booktitle,
    entry.fields.publisher,
    entry.fields.howpublished
  ]
    .map(cleanValue)
    .find(Boolean) ?? "";

  const yearValue = cleanValue(entry.fields.year);
  const parsedYear = Number.parseInt(yearValue, 10);

  return {
    ok: true as const,
    value: {
      bibtexKey: entry.citationKey,
      rawBibtex: entry.raw,
      title,
      authorsText,
      firstAuthor: getFirstAuthor(authorsText),
      year: Number.isNaN(parsedYear) ? null : parsedYear,
      venue,
      abstract: cleanValue(entry.fields.abstract),
      keywordsText: cleanValue(entry.fields.keywords),
      doi: cleanValue(entry.fields.doi)
    } satisfies NormalizedPaperInput
  };
}
