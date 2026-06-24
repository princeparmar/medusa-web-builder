import { exec } from "child_process"
import { promisify } from "util"
import { join } from "path"
import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { getShopPath, getShopsRoot } from "../shops/paths"
import {
  type PageConfigEntry,
  type PagesConfigFile,
  type SegmentRef,
  readPagesConfigFileFromRepo,
  writePagesConfigFileToRepo,
  expandPagesConfigForBuilder,
  segmentPackageName,
  hasSegmentData,
} from "../config/pages-config"

const execAsync = promisify(exec)

export type ScaffoldOptions = {
  projectId: string
  shopSlug: string
  preset?: "full" | "minimal"
  defaultRegion?: string
}

export async function scaffoldStorefrontProject(options: ScaffoldOptions): Promise<string> {
  const { shopSlug, preset = "full", defaultRegion = "in" } = options
  const shopsRoot = getShopsRoot()
  const repoPath = getShopPath(shopSlug)

  if (existsSync(join(repoPath, "storefront"))) {
    await initBuilderConfigFiles(repoPath)
    return repoPath
  }

  const cmd = [
    "npx",
    "@pradip1995/create-storefront-app@0.5.4",
    shopSlug,
    `--dir "${shopsRoot}"`,
    `--preset ${preset}`,
    `--default-region ${defaultRegion}`,
    "--no-prompt",
    "--no-install",
  ].join(" ")

  await execAsync(cmd, { cwd: shopsRoot, timeout: 300_000 })

  await initBuilderConfigFiles(repoPath)

  return repoPath
}

async function initBuilderConfigFiles(repoPath: string): Promise<void> {
  const builderDir = join(repoPath, "storefront", "builder")
  await mkdir(builderDir, { recursive: true })

  const brandPath = join(builderDir, "brand.json")
  if (!existsSync(brandPath)) {
    await writeFile(
      brandPath,
      JSON.stringify(
        {
          companyName: "",
          logoUrl: "",
          logoUrlLight: "",
          faviconUrl: "",
          ogImageUrl: "",
          watermarkUrl: "",
          contactEmail: "",
          contactPhone: "",
          social: {},
          colors: {
            primary: "#5a2a43",
            secondary: "#8b4567",
            accent: "#c9a66b",
            background: "#ffffff",
            text: "#1f2937",
            muted: "#6b7280",
          },
          fonts: {
            h1: "Inter",
            h2: "Inter",
            h3: "Inter",
            h4: "Inter",
            h5: "Inter",
            h6: "Inter",
            title: "Inter",
            body: "Inter",
            bullet: "Inter",
          },
        },
        null,
        2
      ) + "\n"
    )
  }

  const sectionPropsPath = join(builderDir, "section-props.json")
  if (!existsSync(sectionPropsPath)) {
    await writeFile(sectionPropsPath, "{}\n")
  }

  const sectionsConfigPath = join(builderDir, "sections.config.json")
  if (!existsSync(sectionsConfigPath)) {
    await writeFile(
      sectionsConfigPath,
      JSON.stringify({ version: "1", updatedAt: new Date().toISOString(), segments: {} }, null, 2) + "\n"
    )
  }

  const bindingsPath = join(repoPath, "backend", "builder-bindings.json")
  if (!existsSync(bindingsPath)) {
    await mkdir(join(repoPath, "backend"), { recursive: true })
    await writeFile(
      bindingsPath,
      JSON.stringify({ version: "1", plugins: {}, providers: {} }, null, 2) + "\n"
    )
  }

  await ensureMwbGitignored(repoPath)
}

async function ensureMwbGitignored(repoPath: string): Promise<void> {
  const gitignorePath = join(repoPath, ".gitignore")
  const entry = ".mwb/"
  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, `${entry}\n`)
    return
  }
  const content = await readFile(gitignorePath, "utf8")
  if (!content.split("\n").some((line) => line.trim() === entry || line.trim() === ".mwb")) {
    await writeFile(gitignorePath, content.endsWith("\n") ? `${content}${entry}\n` : `${content}\n${entry}\n`)
  }
}

export async function readPagesConfig(repoPath: string): Promise<PageConfigEntry[]> {
  const file = await readPagesConfigFileFromRepo(repoPath)
  return expandPagesConfigForBuilder(file).pages
}

export async function readPagesConfigFile(repoPath: string): Promise<PagesConfigFile> {
  return readPagesConfigFileFromRepo(repoPath)
}

export async function readBuilderState(repoPath: string): Promise<{
  pages: Array<Omit<PageConfigEntry, "segments"> & { segments: string[] }>
  sectionProps: Record<string, Record<string, unknown>>
}> {
  const file = await readPagesConfigFileFromRepo(repoPath)
  return expandPagesConfigForBuilder(file)
}

export async function writePagesConfig(
  repoPath: string,
  pages: Array<Omit<PageConfigEntry, "segments"> & { segments: string[] }>
): Promise<void> {
  const existing = await readPagesConfigFileFromRepo(repoPath)

  const resolveRef = (route: string, pkg: string): SegmentRef => {
    const prevPage = existing.pages.find((p) => p.route === route)
    const prevRef = prevPage?.segments.find((r) => segmentPackageName(r) === pkg)
    if (prevRef && hasSegmentData(prevRef)) return prevRef
    const chromeRef = existing.chrome?.find((r) => segmentPackageName(r) === pkg)
    if (chromeRef && hasSegmentData(chromeRef)) return chromeRef
    return pkg
  }

  await writePagesConfigFileToRepo(repoPath, {
    ...existing,
    pages: pages.map((page) => {
      const prev = existing.pages.find((p) => p.route === page.route)
      return {
        route: page.route,
        workflow: page.workflow ?? prev?.workflow ?? "",
        layout: page.layout ?? prev?.layout ?? "",
        metadata: page.metadata ?? prev?.metadata,
        segments: page.segments.map((pkg) => resolveRef(page.route, pkg)),
      }
    }),
  })
}

export async function writePagesConfigFile(repoPath: string, file: PagesConfigFile): Promise<void> {
  await writePagesConfigFileToRepo(repoPath, file)
}

export async function readBrandConfig(repoPath: string): Promise<Record<string, unknown>> {
  const path = join(repoPath, "storefront", "builder", "brand.json")
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, "utf8"))
}

export async function writeBrandConfig(repoPath: string, brand: Record<string, unknown>): Promise<void> {
  const path = join(repoPath, "storefront", "builder", "brand.json")
  await mkdir(join(repoPath, "storefront", "builder"), { recursive: true })
  await writeFile(path, JSON.stringify(brand, null, 2) + "\n")
}

export async function readSectionProps(repoPath: string): Promise<Record<string, unknown>> {
  const path = join(repoPath, "storefront", "builder", "section-props.json")
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, "utf8"))
}

export async function writeSectionProps(
  repoPath: string,
  props: Record<string, unknown>
): Promise<void> {
  const path = join(repoPath, "storefront", "builder", "section-props.json")
  await mkdir(join(repoPath, "storefront", "builder"), { recursive: true })
  await writeFile(path, JSON.stringify(props, null, 2) + "\n")
}

export { getShopPath } from "../shops/paths"
export { seedInitialBuilderState, LAYOUT_SHELL_PACKAGES } from "./seed-defaults"
export type { RegistrySectionSeed } from "./seed-defaults"
