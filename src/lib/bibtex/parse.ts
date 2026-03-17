import { toJSON } from "bibtex-parse-js";

export interface ParsedBibtexEntry {
  raw: string;
  citationKey: string;
  entryType: string;
  fields: Record<string, string>;
}

function splitBibtexEntries(input: string) {
  const entries: string[] = [];
  let start = -1;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === "@") {
      if (depth === 0) {
        start = index;
      }
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        entries.push(input.slice(start, index + 1).trim());
        start = -1;
      }
    }
  }

  return entries;
}

export function parseBibtex(input: string) {
  const rawEntries = splitBibtexEntries(input);
  const parsed: ParsedBibtexEntry[] = [];
  const failures: Array<{ raw: string; error: string }> = [];

  for (const raw of rawEntries) {
    try {
      const [entry] = toJSON(raw);
      if (!entry) {
        throw new Error("Unsupported BibTeX entry");
      }
      parsed.push({
        raw,
        citationKey: entry.citationKey,
        entryType: entry.entryType,
        fields: entry.entryTags
      });
    } catch (error) {
      failures.push({
        raw,
        error: error instanceof Error ? error.message : "Unknown BibTeX parse error"
      });
    }
  }

  return {
    rawEntries,
    parsed,
    failures
  };
}
