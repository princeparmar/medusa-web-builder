import { z } from "zod"

export const BuilderFieldSchema = z.object({
  id: z.string(),
  type: z.enum([
    "short-text",
    "long-text",
    "file",
    "image",
    "select",
    "boolean",
    "number",
    "array",
    "object",
    "color",
  ]),
  label: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  options: z.array(z.string()).optional(),
  group: z.string().optional(),
  /** Suggested storage for this value in the project repo / GitHub Actions */
  storage: z.enum(["hardcoded", "github-variable", "github-secret"]).optional(),
  /** When true, UI suggests github-secret */
  sensitive: z.boolean().optional(),
  /** Suggested GitHub secret or variable name (e.g. SMTP_HOST) */
  envName: z.string().optional(),
})

export const BuilderSettingsSchema = z.object({
  version: z.string(),
  fields: z.array(BuilderFieldSchema),
  groups: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  inherits: z.array(z.string()).optional(),
})

export type BuilderSettings = z.infer<typeof BuilderSettingsSchema>
export type BuilderField = z.infer<typeof BuilderFieldSchema>
