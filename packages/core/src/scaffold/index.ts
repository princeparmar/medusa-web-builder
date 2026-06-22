import { exec } from "child_process"
import { promisify } from "util"
import { join, resolve } from "path"
import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { getProjectRepoPath, getWorkspaceRoot } from "../git/index"

const execAsync = promisify(exec)

export type ScaffoldOptions = {
  projectId: string
  preset?: "full" | "minimal"
  defaultRegion?: string
}

export async function scaffoldStorefrontProject(options: ScaffoldOptions): Promise<string> {
  const { projectId, preset = "full", defaultRegion = "in" } = options
  const workspaceRoot = getWorkspaceRoot()
  const workspaceDir = join(workspaceRoot, projectId)
  const projectName = `storefront-${projectId}`
  const repoPath = resolve(join(workspaceDir, projectName))

  await mkdir(workspaceDir, { recursive: true })

  const cmd = [
    "npx",
    "@pradip1995/create-storefront-app",
    projectName,
    `--dir "${workspaceDir}"`,
    `--preset ${preset}`,
    `--default-region ${defaultRegion}`,
    "--no-prompt",
    "--no-install",
  ].join(" ")

  await execAsync(cmd, { cwd: workspaceRoot, timeout: 300_000 })

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

  const segmentDataPath = join(builderDir, "segment-data.json")
  if (!existsSync(segmentDataPath)) {
    await writeFile(
      segmentDataPath,
      JSON.stringify({ version: "1", updatedAt: new Date().toISOString(), data: {} }, null, 2) + "\n"
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
}

export async function readPagesConfig(repoPath: string): Promise<unknown[]> {
  const path = join(repoPath, "storefront", "pages.config.json")
  const content = await readFile(path, "utf8")
  return JSON.parse(content)
}

export async function writePagesConfig(repoPath: string, pages: unknown[]): Promise<void> {
  const path = join(repoPath, "storefront", "pages.config.json")
  await writeFile(path, JSON.stringify(pages, null, 2) + "\n")
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

export { getProjectRepoPath }
export { seedInitialBuilderState, LAYOUT_SHELL_PACKAGES } from "./seed-defaults"
export type { RegistrySectionSeed } from "./seed-defaults"
