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
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  options: z.array(z.string()).optional(),
  group: z.string().optional(),
  /** Suggested storage for this value in the project repo / GitHub Actions */
  storage: z.enum(["hardcoded", "github-variable", "github-secret"]).optional(),
  /** Restrict which storage modes appear in the builder UI */
  allowedStorage: z
    .array(z.enum(["hardcoded", "github-variable", "github-secret"]))
    .optional(),
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
  defaults: z.record(z.unknown()).optional(),
})

/** Declares a Medusa module provider shipped with a plugin package */
const ProviderSettingsEntrySchema = z.object({
  module: z.enum(["auth", "fulfillment", "payment", "notification", "file"]),
  providerId: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  requiresPlugin: z.string().optional(),
  medusaResolve: z.string().optional(),
  settings: BuilderSettingsSchema,
})

export const ProviderSettingsFileSchema = z.union([
  ProviderSettingsEntrySchema.extend({ version: z.string() }),
  z.object({
    version: z.string(),
    providers: z.array(ProviderSettingsEntrySchema),
  }),
])

export type BuilderSettings = z.infer<typeof BuilderSettingsSchema>
export type BuilderField = z.infer<typeof BuilderFieldSchema>
export type ProviderSettingsFile = z.infer<typeof ProviderSettingsFileSchema>
