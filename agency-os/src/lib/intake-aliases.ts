import { z } from "zod";

export const intakeAliasesSchema = z.object({
  kind: z.enum(["project", "profile"]),
  id: z.uuid(),
  text: z.string().max(4000).transform((text) => [...new Set(text.split(/[\n;]/).map((value) => value.trim()).filter(Boolean))])
    .pipe(z.array(z.string().min(1).max(80)).max(40)),
});
