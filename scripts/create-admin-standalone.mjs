#!/usr/bin/env node
/**
 * Production admin bootstrap for the standalone deploy.
 * Run from the web deploy directory with .env loaded (DATABASE_URL).
 *
 *   node scripts/create-admin-standalone.mjs email@x.com password
 */
import { createRequire } from "module"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const email = process.argv[2] || process.env.ADMIN_EMAIL
const password = process.argv[3] || process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error("Usage: node scripts/create-admin-standalone.mjs email password")
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

async function main() {
  // Prefer traced deps in standalone
  let PrismaClient
  let hash
  try {
    ;({ PrismaClient } = await import("@prisma/client"))
  } catch {
    ;({ PrismaClient } = require("@prisma/client"))
  }
  try {
    ;({ hash } = await import("bcryptjs"))
  } catch {
    ;({ hash } = require("bcryptjs"))
  }

  const prisma = new PrismaClient()
  const passwordHash = await hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Super Admin",
      emailVerified: new Date(),
      onboardingStep: "COMPLETE",
      isAdmin: true,
      adminRole: "SUPER_ADMIN",
    },
    update: {
      passwordHash,
      emailVerified: new Date(),
      isAdmin: true,
      adminRole: "SUPER_ADMIN",
    },
  })

  console.log(`Admin ready: ${user.email} (SUPER_ADMIN, id: ${user.id})`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
