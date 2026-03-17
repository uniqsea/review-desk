declare module "bibtex-parse-js" {
  export interface BibtexEntry {
    citationKey: string;
    entryType: string;
    entryTags: Record<string, string>;
  }

  export function toJSON(input: string): BibtexEntry[];
}
