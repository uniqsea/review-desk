import { z } from "zod";

export const paperQuerySchema = z.object({
  status: z.enum(["all", "pending", "included", "excluded", "uncertain", "processed"]).default("all"),
  q: z.string().optional().default("")
});
