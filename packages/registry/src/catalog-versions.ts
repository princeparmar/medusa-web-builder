import { prisma, type CatalogKind } from "@mwb/db"
import { pickMaxVersion } from "./version"

/** Record a catalog version and refresh latestVersion on the registry row. */
export async function addCatalogPackageVersion(params: {
  kind: CatalogKind
  registryId: string
  version: string
  notes?: string | null
}): Promise<{ version: string; latestVersion: string }> {
  const { kind, registryId, version, notes } = params

  await prisma.catalogPackageVersion.upsert({
    where: {
      kind_registryId_version: { kind, registryId, version },
    },
    create: { kind, registryId, version, notes: notes ?? null },
    update: notes !== undefined ? { notes } : {},
  })

  const versions = await prisma.catalogPackageVersion.findMany({
    where: { kind, registryId },
    select: { version: true },
  })
  const latestVersion = pickMaxVersion(versions.map((v) => v.version))

  if (kind === "SECTION") {
    await prisma.sectionRegistry.update({
      where: { id: registryId },
      data: { latestVersion },
    })
  } else {
    await prisma.pluginRegistry.update({
      where: { id: registryId },
      data: { latestVersion },
    })
  }

  return { version, latestVersion }
}

export async function listCatalogPackageVersions(kind: CatalogKind, registryId: string) {
  return prisma.catalogPackageVersion.findMany({
    where: { kind, registryId },
    orderBy: { createdAt: "desc" },
  })
}

export async function listCatalogMedia(kind: CatalogKind, registryId: string) {
  return prisma.catalogMedia.findMany({
    where: { kind, registryId },
    orderBy: { createdAt: "desc" },
  })
}
