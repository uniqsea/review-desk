import { z } from "zod";

export const decisionSchema = z
  .object({
    decision: z.enum(["included", "excluded", "uncertain"]),
    reason: z.string().trim().optional().default("")
  })
  .superRefine((value, ctx) => {
    if (value.decision === "excluded" && value.reason.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reason is required when excluding a paper",
        path: ["reason"]
      });
    }
  });
