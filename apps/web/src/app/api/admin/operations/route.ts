import { NextResponse } from "next/server"
import { existsSync } from "fs"
import { resolve } from "path"
import { prisma } from "@mwb/db"
import { requireAdmin } from "@/lib/auth-helpers"
import { getWorkerHealth, listQueueJobs } from "@mwb/core/queue"
import { getShopLocalSnapshot, listProjectLocalRuns } from "@mwb/core/shops"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const worker = await getWorkerHealth()
  const [projects, queueJobs, workerRuns] = await Promise.all([
    prisma.project.findMany({
      where: { workspacePath: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        workspacePath: true,
        status: true,
        members: {
          select: {
            role: true,
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    listQueueJobs(100),
    listProjectLocalRuns(),
  ])

  const servers = await Promise.all(
    projects.map(async (project) => {
      const shopPath = project.workspacePath ? resolve(project.workspacePath) : null
      const snapshot =
        shopPath && existsSync(shopPath)
          ? await getShopLocalSnapshot(shopPath, project.id, project.slug)
          : {
              status: "stopped" as const,
              backendPort: 9000,
              storefrontPort: 8000,
              savedStatus: "stopped" as const,
              workerStatus: "stopped" as const,
              message: "No workspace",
              health: {
                backend: false,
                storefront: false,
                backendUrl: "http://127.0.0.1:9000/health",
                storefrontUrl: "http://127.0.0.1:8000",
              },
              detectedBy: "saved" as const,
            }

      const workerRun = workerRuns.find((r) => r.projectId === project.id) ?? null
      const jobs = queueJobs.filter((j) => j.projectId === project.id)

      return {
        projectId: project.id,
        projectName: project.name,
        slug: project.slug,
        projectStatus: project.status,
        owners: project.members
          .filter((m) => m.role === "OWNER")
          .map((m) => m.user.email ?? m.user.name ?? m.user.id),
        members: project.members.map((m) => ({
          role: m.role,
          email: m.user.email,
          name: m.user.name,
        })),
        local: snapshot,
        workerRun,
        jobs,
      }
    })
  )

  return NextResponse.json({
    worker,
    queueJobs,
    workerRuns,
    servers,
  })
}
