#!/usr/bin/env tsx
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { randomUUID } from "crypto"
import { loadRootEnv } from "../../../scripts/load-env.mjs"

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..")
loadRootEnv(monorepoRoot)

const require = createRequire(join(monorepoRoot, "apps/web/package.json"))
const { hash } = require("bcryptjs") as typeof import("bcryptjs")

const { prisma } = await import("@mwb/db")
const { scaffoldStorefrontProject, seedInitialBuilderState, readPagesConfig } =
  await import("@mwb/core/scaffold")
const { encrypt } = await import("@mwb/core/crypto")

const email = process.env.TEST_SHOP_EMAIL ?? "test@medusa-web-builder.local"
const password = process.env.TEST_SHOP_PASSWORD ?? "testshop123"
const shopName = process.env.TEST_SHOP_NAME ?? `Test Shop ${new Date().toISOString().slice(0, 10)}`

async function main() {
  const passwordHash = await hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Test User",
      emailVerified: new Date(),
      onboardingStep: "PROJECT_CREATED",
    },
    update: {
      passwordHash,
      emailVerified: new Date(),
      onboardingStep: "PROJECT_CREATED",
    },
  })

  const slug = `test-shop-${Date.now().toString(36)}`
  const projectId = randomUUID()

  const project = await prisma.project.create({
    data: {
      id: projectId,
      name: shopName,
      slug,
      preset: "full",
      status: "SCAFFOLDING",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  })

  console.log("Scaffolding storefront (this may take a few minutes)...")
  const repoPath = await scaffoldStorefrontProject({
    projectId,
    shopSlug: slug,
    preset: "full",
    defaultRegion: user.defaultRegion,
  })

  const { ensureShopDatabase, writeShopEnv } = await import("@mwb/core/shops")
  await ensureShopDatabase(slug)
  await writeShopEnv(repoPath, slug, {})

  const registry = await prisma.sectionRegistry.findMany()
  await seedInitialBuilderState(repoPath, registry)

  const draftId = randomUUID()
  const pages = await readPagesConfig(repoPath).catch(() => [])

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        status: "READY",
        workspacePath: repoPath,
        errorMessage: null,
      },
    }),
    prisma.draft.create({
      data: {
        id: draftId,
        projectId,
        name: "Initial draft",
        gitBranch: `draft/${draftId}`,
        isActive: true,
        pagesConfigSnapshot: pages as object,
      },
    }),
    prisma.projectSecret.upsert({
      where: { projectId },
      create: {
        projectId,
        backendUrl: "http://localhost:9000",
        encryptedPublishableKey: encrypt("pk_placeholder"),
      },
      update: {},
    }),
  ])

  console.log("")
  console.log("Test shop created successfully.")
  console.log("  Project ID:", project.id)
  console.log("  Name:", project.name)
  console.log("  Workspace:", repoPath)
  console.log("  Login:", email, "/", password)
  console.log("  Builder: http://localhost:3100/projects/" + project.id + "/builder")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
