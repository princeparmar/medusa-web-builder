import { NextResponse } from "next/server"
import { prisma } from "@mwb/db"
import { filterSectionsForPage } from "@mwb/registry"

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

  return NextResponse.json({ sections: filtered })
}
