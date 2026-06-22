/** Navigation and footer are rendered by the page layout shell, not as page segments. */
export function isLayoutShellPackage(packageName: string): boolean {
  const slug = packageName.split("/").pop() ?? packageName
  return slug === "segment-nav" || slug === "segment-footer"
}

export function stripLayoutShells(segments: string[]): string[] {
  return segments.filter((s) => !isLayoutShellPackage(s))
}
