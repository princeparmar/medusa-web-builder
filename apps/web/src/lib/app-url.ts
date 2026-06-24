/** Public app origin for redirects and links (avoids 0.0.0.0:3000 inside Docker). */
export function getAppBaseUrl(request?: Request): string {
  const fromEnv = process.env.NEXTAUTH_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const host = forwardedHost ?? request.headers.get("host")
    if (host && !host.startsWith("0.0.0.0")) {
      const proto = request.headers.get("x-forwarded-proto") ?? "http"
      return `${proto}://${host}`
    }
  }

  return "http://localhost:3000"
}

export function appUrl(path: string, request?: Request): URL {
  const base = getAppBaseUrl(request)
  return new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`)
}
