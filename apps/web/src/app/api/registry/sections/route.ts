import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { requireAuth } from "@/lib/auth-helpers"
import { enqueueRegistryJob } from "@mwb/core/queue"
import { filterSectionsForPage } from "@mwb/registry"
import { z } from "zod"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageType = searchParams.get("pageType")
  const all = searchParams.get("all") === "true"

  const sections = await prisma.sectionRegistry.findMany({
    orderBy: [{ componentType: "asc" }, { displayName: "asc" }],
  })

  const enriched = sections.map((s) => ({
    ...s,
    latestVersion: s.latestVersion ?? s.version,
    updateAvailable: (s.latestVersion ?? s.version) !== s.version,
  }))

  const filtered =
    pageType && !all
      ? filterSectionsForPage(
          enriched.map((s) => ({
            ...s,
            installedVersion: s.version,
            updateAvailable: (s.latestVersion ?? s.version) !== s.version,
          })),
          pageType
        )
      : enriched

  const sources = await prisma.sectionSource.findMany({ orderBy: { createdAt: "desc" } })

  return NextResponse.json({
    sections: filtered,
    sources,
    storefrontComponentsRepo:
      process.env.STOREFRONT_COMPONENTS_GITHUB ??
      "https://github.com/pradip1995/storefront-components",
  })
}

const registerSchema = z.object({
  githubRepo: z.string().url(),
  branch: z.string().default("main"),
})

export async function POST(request: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const data = registerSchema.parse(body)

  await enqueueRegistryJob({
    type: "github-repo",
    githubRepo: data.githubRepo,
    branch: data.branch,
  })

  return NextResponse.json({ status: "queued" }, { status: 202 })
}
