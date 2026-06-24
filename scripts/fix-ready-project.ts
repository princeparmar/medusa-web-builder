import { loadRootEnv } from "./load-env.mjs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), ".."))

import { prisma } from "@mwb/db"
import { getShopPath } from "@mwb/core/shops"
import { encrypt } from "@mwb/core/crypto"
import { readPagesConfig } from "@mwb/core/scaffold"

async function main() {
  const projectId = process.argv[2] ?? "e422f03e-df9b-4550-8f4d-3738943da34f"
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error("Project not found")

  const repoPath = getShopPath(project.slug)
  if (!existsSync(join(repoPath, "storefront"))) {
    throw new Error(`Shop not found at ${repoPath}`)
  }

  const draftId = crypto.randomUUID()
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
    prisma.draft.deleteMany({ where: { projectId } }),
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

  console.log(`Project "${project.name}" is READY at ${repoPath}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
