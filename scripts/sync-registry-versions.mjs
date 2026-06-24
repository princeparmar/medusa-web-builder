#!/usr/bin/env node
/**
 * Sync MWB registry catalog version metadata from local monorepo package.json files.
 * Usage:
 *   node scripts/sync-registry-versions.mjs [--components-path=/path] [--plugins-path=/path]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`))
  return hit ? hit.slice(flag.length + 1) : null
}

const componentsPath = argValue("--components-path")
const pluginsPath =
  argValue("--plugins-path") ||
  process.env.MEDUSA_PLUGINS_PATH ||
  join(root, "../medusa-plugins")

function readPkgVersions(dir, scope = null) {
  const versions = new Map()
  if (!existsSync(dir)) return versions
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgPath = join(dir, entry.name, "package.json")
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (!pkg.name || !pkg.version) continue
    const key = scope ? pkg.name.replace(`${scope}/`, "") : pkg.name
    versions.set(key, pkg.version)
  }
  return versions
}

function updatePluginsCatalog(versions) {
  const path = join(root, "packages/registry/src/plugins-catalog.ts")
  let content = readFileSync(path, "utf8")
  let count = 0
  for (const [name, version] of versions) {
    const re = new RegExp(
      `(plugin\\("${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^"]*"[^"]*"[^"]*")"[^"]+"`,
      "g"
    )
    const next = content.replace(re, `$1"${version}"`)
    if (next !== content) {
      content = next
      count++
    }
  }
  writeFileSync(path, content)
  return count
}

const componentVersions = componentsPath
  ? readPkgVersions(join(componentsPath, "packages"), "@pradip1995")
  : new Map()
const pluginVersions = readPkgVersions(pluginsPath)

const pluginsUpdated = updatePluginsCatalog(pluginVersions)
console.log(`Updated ${pluginsUpdated} plugin catalog entries from ${pluginsPath}`)

if (componentsPath) {
  console.log(`Found ${componentVersions.size} component packages under ${componentsPath}`)
  const hero = componentVersions.get("segment-hero")
  console.log(`Latest segment-hero: ${hero ?? "n/a"}`)
} else {
  console.log("Skipped component versions (pass --components-path to scan storefront-components)")
}

const compiler = existsSync(join(root, "../storefront-framework/packages/framework-compiler/package.json"))
  ? JSON.parse(
      readFileSync(join(root, "../storefront-framework/packages/framework-compiler/package.json"), "utf8")
    ).version
  : null
console.log(`framework-compiler: ${compiler ?? "n/a"}`)
