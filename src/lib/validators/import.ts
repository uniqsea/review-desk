import { z } from "zod";

export const importTextSchema = z.object({
  text: z.string().min(1, "BibTeX text is required")
});
