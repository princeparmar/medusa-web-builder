import { loadRootEnv } from "./load-env.mjs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), ".."))

import { prisma } from "@mwb/db"
import { enqueueProjectJob } from "@mwb/core/queue"

async function main() {
  const projectId = process.argv[2]
  const project = projectId
    ? await prisma.project.findUnique({ where: { id: projectId } })
    : await prisma.project.findFirst({ where: { status: "ERROR" }, orderBy: { updatedAt: "desc" } })

  if (!project) {
    console.log("No failed project found")
    return
  }

  const owner = await prisma.projectMember.findFirst({
    where: { projectId: project.id, role: "OWNER" },
    include: { user: true },
  })

  console.log(`Retrying setup for "${project.name}" (${project.id})`)
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "SCAFFOLDING", errorMessage: null },
  })

  await enqueueProjectJob(
    "scaffold",
    {
      projectId: project.id,
      preset: project.preset as "full" | "minimal",
      defaultRegion: owner?.user.defaultRegion ?? "in",
    },
    `scaffold-retry-${project.id}-${Date.now()}`
  )

  console.log("Scaffold job queued — ensure the worker is running")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
