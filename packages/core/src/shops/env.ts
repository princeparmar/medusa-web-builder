import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { shopDatabaseUrl, shopInfraEnv } from "./infra"
import { getPublishableKeyStatus, isPlaceholderPublishableKey, publishableKeyMissingMessage, resolveShopDatabaseUrl } from "./publishable-key"

export type ShopEnvField = {
  key: string
  label: string
  group: "core" | "auth" | "payment" | "fulfillment" | "notification" | "storage"
  secret?: boolean
}

export type ShopAutoEnvField = {
  key: string
  label: string
  source: string
}

/** Manual backend credentials — storefront env is auto-synced separately. */
export const SHOP_BACKEND_ENV_FIELDS: ShopEnvField[] = [
  { key: "JWT_SECRET", label: "JWT secret", group: "core", secret: true },
  { key: "COOKIE_SECRET", label: "Cookie secret", group: "core", secret: true },
  { key: "GOOGLE_CLIENT_ID", label: "Google client ID", group: "auth" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google client secret", group: "auth", secret: true },
  { key: "CASHFREE_CLIENT_ID", label: "Cashfree client ID", group: "payment" },
  { key: "CASHFREE_CLIENT_SECRET", label: "Cashfree client secret", group: "payment", secret: true },
  { key: "CASHFREE_ENVIRONMENT", label: "Cashfree environment", group: "payment" },
  { key: "SHIPROCKET_EMAIL", label: "Shiprocket email", group: "fulfillment" },
  { key: "SHIPROCKET_PASSWORD", label: "Shiprocket password", group: "fulfillment", secret: true },
  { key: "SHIPROCKET_PICKUP_LOCATION", label: "Shiprocket pickup location", group: "fulfillment" },
  { key: "SHIPROCKET_WEBHOOK_SECRET", label: "Shiprocket webhook secret", group: "fulfillment", secret: true },
  { key: "SMTP_USER", label: "SMTP user", group: "notification" },
  { key: "SMTP_PASS", label: "SMTP password", group: "notification", secret: true },
  { key: "SMTP_FROM", label: "SMTP from address", group: "notification" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio account SID", group: "notification" },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio auth token", group: "notification", secret: true },
  { key: "TWILIO_PHONE", label: "Twilio phone", group: "notification" },
  { key: "AWS_ACCESS_KEY", label: "AWS access key", group: "storage" },
  { key: "AWS_SECRET_ACCESS_KEY", label: "AWS secret key", group: "storage", secret: true },
  { key: "AWS_REGION", label: "AWS region", group: "storage" },
  { key: "AWS_BUCKET", label: "S3 bucket", group: "storage" },
  { key: "AWS_FILE_URL", label: "S3 public URL prefix", group: "storage" },
]

/** @deprecated Use SHOP_BACKEND_ENV_FIELDS */
export const SHOP_ENV_FIELDS = SHOP_BACKEND_ENV_FIELDS

/** Storefront values written automatically — shown read-only in the UI. */
export const SHOP_AUTO_ENV_FIELDS: ShopAutoEnvField[] = [
  { key: "NEXT_PUBLIC_MEDUSA_BACKEND_URL", label: "Medusa backend URL", source: "Local dev ports" },
  { key: "NEXT_PUBLIC_BASE_URL", label: "Storefront URL", source: "Local dev ports" },
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    label: "Medusa publishable key",
    source: "Fetched from backend database after seed",
  },
  { key: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", label: "Google client ID", source: "Copied from backend GOOGLE_CLIENT_ID" },
]

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function serializeEnvFile(values: Record<string, string>, header: string): string {
  const lines = [header, ""]
  for (const [k, v] of Object.entries(values)) {
    if (v === "") continue
    lines.push(`${k}=${v}`)
  }
  return lines.join("\n") + "\n"
}

export async function readShopEnv(shopPath: string): Promise<Record<string, string>> {
  const backendPath = join(shopPath, "backend", ".env")
  const storefrontPath = join(shopPath, "storefront", ".env.local")
  const merged: Record<string, string> = {}

  if (existsSync(backendPath)) {
    Object.assign(merged, parseEnvFile(await readFile(backendPath, "utf8")))
  }
  if (existsSync(storefrontPath)) {
    Object.assign(merged, parseEnvFile(await readFile(storefrontPath, "utf8")))
  }
  return merged
}

export async function writeShopEnv(
  shopPath: string,
  slug: string,
  patch: Record<string, string>
): Promise<void> {
  const infra = shopInfraEnv()
  const current = await readShopEnv(shopPath)

  const infraDefaults: Record<string, string> = {
    DATABASE_URL: shopDatabaseUrl(slug),
    REDIS_URL: infra.redisUrl,
    STORE_CORS: `${infra.storefrontUrl},${infra.backendUrl}`,
    ADMIN_CORS: `${infra.backendUrl},http://localhost:7001`,
    AUTH_CORS: `${infra.storefrontUrl},${infra.backendUrl}`,
    STOREFRONT_URL: infra.storefrontUrl,
    MEDUSA_BACKEND_URL: infra.backendUrl,
    SMTP_HOST: infra.smtpHost,
    SMTP_PORT: infra.smtpPort,
    SMTP_SECURE: "false",
    GOOGLE_CALLBACK_URL: `${infra.storefrontUrl}/auth/customer/google/callback`,
  }

  const backendDefaults: Record<string, string> = {
    JWT_SECRET: "dev-jwt-secret-change-me",
    COOKIE_SECRET: "dev-cookie-secret-change-me",
    ...current,
    ...infraDefaults,
    ...patch,
  }

  const storefrontDefaults: Record<string, string> = {
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: infra.backendUrl,
    NEXT_PUBLIC_BASE_URL: infra.storefrontUrl,
    NEXT_PUBLIC_DEFAULT_REGION: "in",
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: patch.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? current.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "pk_test",
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: patch.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? current.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? backendDefaults.GOOGLE_CLIENT_ID ?? "",
    ...Object.fromEntries(
      Object.entries({ ...current, ...patch }).filter(([k]) => k.startsWith("NEXT_PUBLIC_"))
    ),
  }

  await mkdir(join(shopPath, "backend"), { recursive: true })
  await mkdir(join(shopPath, "storefront"), { recursive: true })

  await writeFile(
    join(shopPath, "backend", ".env"),
    serializeEnvFile(backendDefaults, "# Generated by Medusa Web Builder — local dev (MWB Postgres/Redis/Mailpit)")
  )
  await writeFile(
    join(shopPath, "storefront", ".env.local"),
    serializeEnvFile(storefrontDefaults, "# Generated by Medusa Web Builder — storefront")
  )
}

/** Pull publishable key + mirrored public vars into storefront/.env.local */
export async function syncAutoStorefrontEnv(
  shopPath: string,
  slug: string
): Promise<{
  synced: Record<string, string>
  missing: string[]
  publishableKeyStatus?: Awaited<ReturnType<typeof getPublishableKeyStatus>>
}> {
  const current = await readShopEnv(shopPath)
  const patch: Record<string, string> = {}

  const databaseUrl = await resolveShopDatabaseUrl(shopPath, slug)
  const publishableKeyStatus = await getPublishableKeyStatus(databaseUrl)
  const publishableKey = publishableKeyStatus.token
  if (publishableKey) {
    patch.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = publishableKey
  }

  if (current.GOOGLE_CLIENT_ID) {
    patch.NEXT_PUBLIC_GOOGLE_CLIENT_ID = current.GOOGLE_CLIENT_ID
  }

  if (Object.keys(patch).length > 0) {
    await writeShopEnv(shopPath, slug, patch)
  }

  const updated = await readShopEnv(shopPath)
  const synced = Object.fromEntries(
    SHOP_AUTO_ENV_FIELDS.map((f) => [f.key, updated[f.key] ?? ""]).filter(([, v]) => v !== "")
  )

  const missing: string[] = []
  if (isPlaceholderPublishableKey(synced.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY)) {
    missing.push(publishableKeyMissingMessage(publishableKeyStatus))
  }

  return { synced, missing, publishableKeyStatus }
}
