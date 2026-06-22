#!/usr/bin/env node
/**
 * Database migration helper — loads root .env and runs Prisma CLI commands.
 *
 * Usage:
 *   node scripts/db.mjs migrate dev [--name my_change]
 *   node scripts/db.mjs migrate deploy
 *   node scripts/db.mjs migrate status
 *   node scripts/db.mjs migrate reset
 *   node scripts/db.mjs generate
 *   node scripts/db.mjs studio
 */
import { spawnSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const DB_PKG = join(ROOT, "packages", "db")
const SCHEMA = join(DB_PKG, "prisma", "schema.prisma")

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const content = readFileSync(path, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(join(ROOT, ".env"))
loadEnvFile(join(ROOT, ".env.local"))

const [command, subcommand, ...rest] = process.argv.slice(2)

const needsDatabase = command !== "generate"

if (needsDatabase && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and configure postgres.")
  process.exit(1)
}

if (!command) {
  console.log(`Usage: node scripts/db.mjs <command> [subcommand] [options]

Commands:
  migrate dev [--name <name>]   Create and apply a migration (development)
  migrate deploy                Apply pending migrations (production / CI / Docker)
  migrate status                Show migration status
  migrate reset                 Reset database and re-apply all migrations (dev only)
  migrate resolve --applied <n> Mark a migration as applied (recovery)
  migrate resolve --rolled-back <n> Mark a migration as rolled back (recovery)
  generate                      Regenerate Prisma Client
  studio                        Open Prisma Studio
  push                          Push schema without migration (prototyping only)
  diff                          Print SQL diff from DB to schema
`)
  process.exit(0)
}

function runPrisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args, "--schema", SCHEMA], {
    cwd: DB_PKG,
    stdio: "inherit",
    env: process.env,
  })
  process.exit(result.status ?? 1)
}

switch (command) {
  case "migrate":
    if (!subcommand) {
      console.error("Specify migrate subcommand: dev | deploy | status | reset | resolve")
      process.exit(1)
    }
    runPrisma(["migrate", subcommand, ...rest])
    break
  case "generate":
    runPrisma(["generate"])
    break
  case "studio":
    runPrisma(["studio"])
    break
  case "push":
    console.warn("Warning: db push skips migration history. Prefer `pnpm db:migrate` for schema changes.")
    runPrisma(["db", "push"])
    break
  case "diff":
    runPrisma([
      "migrate",
      "diff",
      "--from-migrations",
      join(DB_PKG, "prisma", "migrations"),
      "--to-schema-datamodel",
      SCHEMA,
      "--script",
      ...rest,
    ])
    break
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
