import { serializeBibtexEntries } from "@/lib/bibtex/serialize";

function escapeCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }
  return stringValue;
}

export function toCsv(
  rows: Array<{
    id: string;
    title: string;
    authorsText: string | null;
    year: number | null;
    venue: string | null;
    status: string;
    reason: string | null;
    timestamp: string | null;
  }>
) {
  const header = ["ID", "Title", "Authors", "Year", "Venue", "Status", "Reason", "Timestamp"];
  const lines = rows.map((row) =>
    [
      row.id,
      row.title,
      row.authorsText,
      row.year,
      row.venue,
      row.status,
      row.reason,
      row.timestamp
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export function toIncludedBib(entries: string[]) {
  return serializeBibtexEntries(entries);
}
