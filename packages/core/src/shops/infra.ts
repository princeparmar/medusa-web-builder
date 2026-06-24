/** Shared infra for local shop backends — same Postgres/Redis/Mailpit as MWB. */
export function shopInfraEnv() {
  const pgPort = process.env.MWB_POSTGRES_PORT ?? "5433"
  const pgUser = process.env.MWB_POSTGRES_USER ?? "mwb"
  const pgPass = process.env.MWB_POSTGRES_PASSWORD ?? "mwb"
  const pgHost = process.env.MWB_POSTGRES_HOST ?? "localhost"
  const redisPort = process.env.MWB_REDIS_PORT ?? "6380"
  const smtpPort = process.env.MWB_MAILPIT_SMTP_PORT ?? process.env.SMTP_PORT ?? "1125"
  const smtpHost = process.env.MWB_MAILPIT_SMTP_HOST ?? process.env.SMTP_HOST ?? "localhost"

  return {
    pgHost,
    pgPort,
    pgUser,
    pgPass,
    redisUrl: `redis://${process.env.MWB_REDIS_HOST ?? "localhost"}:${redisPort}`,
    smtpHost,
    smtpPort: String(smtpPort),
    backendUrl: "http://localhost:9000",
    storefrontUrl: "http://localhost:8000",
  }
}

export function shopDatabaseName(slug: string): string {
  const safe = slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase()
  return `shop_${safe}`
}

export function shopDatabaseUrl(slug: string): string {
  const infra = shopInfraEnv()
  const db = shopDatabaseName(slug)
  return `postgresql://${infra.pgUser}:${infra.pgPass}@${infra.pgHost}:${infra.pgPort}/${db}`
}
