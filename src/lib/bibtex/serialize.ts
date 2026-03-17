export function serializeBibtexEntries(entries: string[]) {
  return entries.filter(Boolean).join("\n\n");
}
