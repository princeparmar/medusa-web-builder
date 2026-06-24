#!/usr/bin/env tsx
/**
 * Create or promote an admin user.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret pnpm create:admin
 *   pnpm create:admin -- admin@example.com secret
 */
import { loadRootEnv } from "../../../scripts/load-env.mjs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), "../../.."))

import { hash } from "bcryptjs"
import { prisma } from "@mwb/db"

const email = process.argv[2] ?? process.env.ADMIN_EMAIL
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD

async function main() {
  if (!email || !password) {
    console.error("Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm create:admin")
    console.error("   or: pnpm create:admin -- email@example.com password")
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Admin",
      emailVerified: new Date(),
      onboardingStep: "COMPLETE",
      isAdmin: true,
    },
    update: {
      passwordHash,
      emailVerified: new Date(),
      isAdmin: true,
    },
  })

  console.log(`Admin ready: ${user.email} (id: ${user.id})`)
  console.log("Sign in at /admin/login")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
