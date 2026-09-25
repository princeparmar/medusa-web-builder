#!/usr/bin/env tsx
/**
 * Create or promote an admin user.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret pnpm create:admin
 *   pnpm create:admin -- admin@example.com secret
 *   pnpm create:admin -- admin@example.com secret admin
 */
import { loadRootEnv } from "../../../scripts/load-env.mjs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), "../../.."))

import { hash } from "bcryptjs"
import { prisma, type AdminRole } from "@mwb/db"

const email = process.argv[2] ?? process.env.ADMIN_EMAIL
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD
const roleArg = (process.argv[4] ?? process.env.ADMIN_ROLE ?? "super_admin").toLowerCase()

const adminRole: AdminRole = roleArg === "admin" ? "ADMIN" : "SUPER_ADMIN"

async function main() {
  if (!email || !password) {
    console.error("Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm create:admin")
    console.error("   or: pnpm create:admin -- email@example.com password [super_admin|admin]")
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: adminRole === "SUPER_ADMIN" ? "Super Admin" : "Admin",
      emailVerified: new Date(),
      onboardingStep: "COMPLETE",
      isAdmin: true,
      adminRole,
    },
    update: {
      passwordHash,
      emailVerified: new Date(),
      isAdmin: true,
      adminRole,
    },
  })

  console.log(`Admin ready: ${user.email} (${adminRole}, id: ${user.id})`)
  console.log("Sign in at /admin/login")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
