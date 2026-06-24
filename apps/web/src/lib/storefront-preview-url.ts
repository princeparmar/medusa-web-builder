const DEFAULT_REGION = "in"

/** Map builder page route to the URL path on the local Next.js storefront dev server. */
export function storefrontPreviewPath(route: string, region = DEFAULT_REGION): string {
  if (route === "/" || route === "") return `/${region}`
  const path = route.startsWith("/") ? route.slice(1) : route
  if (path.includes("[")) {
    const base = path.split("/")[0]
    if (base === "products") return `/${region}/store`
    return `/${region}/${base}`
  }
  return `/${region}/${path}`
}

export function storefrontPreviewUrl(port: number, route: string, region = DEFAULT_REGION): string {
  return `http://localhost:${port}${storefrontPreviewPath(route, region)}`
}
