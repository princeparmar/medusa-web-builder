export type BuilderField = {
  id: string
  type: string
  label?: string
  description?: string
  default?: unknown
  options?: string[]
  group?: string
  required?: boolean
  /** Default / recommended storage for this field */
  storage?: "hardcoded" | "github-variable" | "github-secret"
  /** Which storage modes the builder may use (defaults to all three) */
  allowedStorage?: Array<"hardcoded" | "github-variable" | "github-secret">
  sensitive?: boolean
  envName?: string
}

export type BuilderSettings = {
  version: string
  fields: BuilderField[]
  groups?: Array<{ id: string; label: string }>
  inherits?: string[]
  /** Pre-filled values (arrays/objects/scalars) applied when a section is first added */
  defaults?: Record<string, unknown>
}
