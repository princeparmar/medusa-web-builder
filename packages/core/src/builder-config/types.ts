export type BuilderField = {
  id: string
  type: string
  label?: string
  default?: unknown
  options?: string[]
  group?: string
  storage?: "hardcoded" | "github-variable" | "github-secret"
  sensitive?: boolean
  envName?: string
}

export type BuilderSettings = {
  version: string
  fields: BuilderField[]
  groups?: Array<{ id: string; label: string }>
  inherits?: string[]
}
