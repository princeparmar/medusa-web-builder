import type { NextConfig } from "next"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { existsSync, readFileSync } from "fs"

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
for (const file of [".env", ".env.local"]) {
  const p = join(monorepoRoot, file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}
if (process.env.WORKSPACE_ROOT && !process.env.WORKSPACE_ROOT.startsWith("/")) {
  process.env.WORKSPACE_ROOT = join(monorepoRoot, process.env.WORKSPACE_ROOT)
}

const nextConfig: NextConfig = {
  transpilePackages: ["@mwb/db", "@mwb/core", "@mwb/registry"],
  output: "standalone",
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*"],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
}

export default nextConfig
