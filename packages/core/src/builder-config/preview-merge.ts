/** Mirrors @pradip1995/framework-runtime merge — kept local so the web app does not depend on the full runtime. */
export type BuilderSegmentDataFile = {
  version: string
  updatedAt: string
  data: Record<string, Record<string, unknown>>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function mergeBuilderSegmentData(
  workflowData: Record<string, unknown>,
  builderData: BuilderSegmentDataFile
): Record<string, unknown> {
  if (!builderData?.data || Object.keys(builderData.data).length === 0) {
    return workflowData
  }

  const merged = { ...workflowData }

  for (const [key, overlay] of Object.entries(builderData.data)) {
    if (!isPlainObject(overlay)) {
      merged[key] = overlay
      continue
    }

    const existing = merged[key]
    if (isPlainObject(existing)) {
      merged[key] = { ...existing, ...overlay }
    } else {
      merged[key] = { ...overlay }
    }
  }

  return merged
}
