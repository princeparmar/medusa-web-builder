import { exec } from "child_process"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { promisify } from "util"
import { shopDatabaseUrl } from "./infra"

const execAsync = promisify(exec)

const PUBLISHABLE_KEY_SQL = `SELECT token FROM api_key WHERE type = 'publishable' AND deleted_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
const PUBLISHABLE_KEY_COUNT_SQL = `SELECT count(*)::int FROM api_key WHERE type = 'publishable' AND deleted_at IS NULL AND revoked_at IS NULL`

export type PublishableKeyStatus = {
  databaseUrl: string
  reachable: boolean
  keyCount: number
  token: string | null
  error?: string
}

export function isValidPublishableKey(token: string | null | undefined): token is string {
  return typeof token === "string" && token.startsWith("pk_") && !token.includes("...")
}

export function isPlaceholderPublishableKey(token: string | null | undefined): boolean {
  return !token || token === "pk_test" || !isValidPublishableKey(token)
}

function parseEnvDatabaseUrl(content: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    if (trimmed.startsWith("DATABASE_URL=")) {
      let val = trimmed.slice("DATABASE_URL=".length).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      return val || null
    }
  }
  return null
}

/** Prefer backend/.env DATABASE_URL — matches what the running Medusa backend uses. */
export async function resolveShopDatabaseUrl(shopPath: string, slug: string): Promise<string> {
  const backendEnv = join(shopPath, "backend", ".env")
  if (existsSync(backendEnv)) {
    const fromFile = parseEnvDatabaseUrl(await readFile(backendEnv, "utf8"))
    if (fromFile) return fromFile
  }
  return shopDatabaseUrl(slug)
}

async function queryDatabase(databaseUrl: string, sql: string): Promise<string> {
  const { stdout } = await execAsync(`psql "${databaseUrl}" -tAc "${sql}"`, {
    encoding: "utf8",
    timeout: 10_000,
  })
  return stdout.trim()
}

export async function getPublishableKeyStatus(
  databaseUrl: string
): Promise<PublishableKeyStatus> {
  try {
    const countRaw = await queryDatabase(databaseUrl, PUBLISHABLE_KEY_COUNT_SQL)
    const keyCount = Number.parseInt(countRaw, 10) || 0
    const tokenRaw = keyCount > 0 ? await queryDatabase(databaseUrl, PUBLISHABLE_KEY_SQL) : ""
    const token = isValidPublishableKey(tokenRaw) ? tokenRaw : null
    return { databaseUrl, reachable: true, keyCount, token }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      databaseUrl,
      reachable: false,
      keyCount: 0,
      token: null,
      error: message.includes("psql")
        ? "could not connect to Postgres (is Docker infra running?)"
        : message,
    }
  }
}

/** Read the latest publishable API key from the shop's Medusa database. */
export async function fetchPublishableKeyFromDatabase(
  slug: string,
  shopPath?: string
): Promise<string | null> {
  const databaseUrl = shopPath
    ? await resolveShopDatabaseUrl(shopPath, slug)
    : shopDatabaseUrl(slug)
  const status = await getPublishableKeyStatus(databaseUrl)
  return status.token
}

export function publishableKeyMissingMessage(status: PublishableKeyStatus): string {
  if (status.error) {
    return `Publishable API key — ${status.error}`
  }
  if (status.keyCount === 0) {
    return (
      "Publishable API key is not in the database yet. Migrations and catalog data do not create it — " +
      "run seed once (creates the pk_ key, region, and sample product), then sync."
    )
  }
  return "Publishable API key — found in database but could not be written to storefront env"
}
