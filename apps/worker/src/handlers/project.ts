import type { Job } from "bullmq"
import { readFile, writeFile, mkdir, cp } from "fs/promises"
import { join, dirname } from "path"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import { prisma } from "@mwb/db"

const execAsync = promisify(exec)
import {
  scaffoldStorefrontProject,
  readPagesConfig,
  seedInitialBuilderState,
} from "@mwb/core/scaffold"
import {
  initAndPush,
  createBranch,
  commitChanges,
  pushBranch,
  mergeBranch,
  createTag,
  checkoutBranch,
  getProjectRepoPath,
  pushRepoToRemote,
} from "@mwb/core/git"
import {
  getRepoName,
  protectMainBranch,
  getOrCreateProjectRepo,
  getAuthenticatedCloneUrl,
  githubCredentialsConfigured,
  formatGithubError,
} from "@mwb/core/github"
import { encrypt } from "@mwb/core/crypto"
import { getRedisConnection } from "@mwb/core/queue"
import type {
  ProjectScaffoldJob,
  ProjectGitCommitJob,
  ProjectPublishJob,
  ProjectGithubProvisionJob,
} from "@mwb/core/queue"
import { logAudit } from "@mwb/core/audit"

async function publishProgress(projectId: string, data: Record<string, unknown>) {
  const redis = getRedisConnection()
  await redis.publish(`job:progress:${projectId}`, JSON.stringify(data))
}

export async function handleScaffold(job: Job<ProjectScaffoldJob>) {
  const { projectId, preset, defaultRegion } = job.data
  await job.updateProgress(10)
  await publishProgress(projectId, { step: "scaffolding", progress: 10 })

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

  try {
    let repoPath = project.workspacePath ?? ""
    if (!repoPath || !existsSync(join(repoPath, "storefront"))) {
      repoPath = await scaffoldStorefrontProject({
        projectId,
        shopSlug: project.slug,
        preset: preset as "full" | "minimal",
        defaultRegion,
      })
    } else {
      await job.log(`Using existing shop at ${repoPath}`)
    }

    const { ensureShopDatabase, writeShopEnv } = await import("@mwb/core/shops")
    await ensureShopDatabase(project.slug)
    await writeShopEnv(repoPath, project.slug, {})

    await job.updateProgress(25)
    await job.log("Installing backend dependencies (npm i)…")
    await execAsync("npm i", {
      cwd: join(repoPath, "backend"),
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const registry = await prisma.sectionRegistry.findMany()
    await seedInitialBuilderState(repoPath, registry)

    await job.updateProgress(40)
    await publishProgress(projectId, { step: "github", progress: 40 })

    let githubRepo: string | null = null
    let githubRepoId: number | null = null
    let cloneUrl = ""

    const hasGithub = githubCredentialsConfigured()
    if (hasGithub) {
      try {
        const repo = await getOrCreateProjectRepo(projectId)
        githubRepo = repo.fullName
        githubRepoId = repo.repoId
        cloneUrl = repo.cloneUrl

        const releaseTemplate = join(process.cwd(), "templates", "project-release.yml")
        if (existsSync(releaseTemplate)) {
          await mkdir(join(repoPath, ".github", "workflows"), { recursive: true })
          await cp(releaseTemplate, join(repoPath, ".github", "workflows", "release.yml"))
        }
      } catch (githubErr) {
        const msg = githubErr instanceof Error ? githubErr.message : String(githubErr)
        await job.log(`Cloud backup skipped during setup: ${msg}`)
      }
    }

    await job.updateProgress(60)

    const githubReady = hasGithub && !!cloneUrl
    if (githubReady) {
      try {
        const authCloneUrl = await getAuthenticatedCloneUrl(cloneUrl)
        await initAndPush({
          repoPath,
          remoteUrl: authCloneUrl,
          message: "chore: scaffold storefront",
        })
        await protectMainBranch(getRepoName(projectId))
      } catch (githubErr) {
        const msg = githubErr instanceof Error ? githubErr.message : String(githubErr)
        await job.log(`Cloud push skipped: ${msg}`)
        githubRepo = null
        githubRepoId = null
        const { prepareRepo } = await import("@mwb/core/git")
        const git = await prepareRepo(repoPath)
        await git.init()
        await git.add(".")
        await git.commit("chore: scaffold storefront (local)")
      }
    } else {
      const { prepareRepo } = await import("@mwb/core/git")
      const git = await prepareRepo(repoPath)
      await git.init()
      await git.add(".")
      await git.commit("chore: scaffold storefront (local)")
    }

    await job.updateProgress(80)

    const draftId = crypto.randomUUID()
    const gitBranch = `draft/${draftId}`

    if (githubReady && githubRepo) {
      await createBranch(repoPath, gitBranch)
      await pushBranch(repoPath, gitBranch)
    }

    const pages = await readPagesConfig(repoPath).catch(() => [])

    await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data: {
          status: "READY",
          githubRepo,
          githubRepoId,
          workspacePath: repoPath,
          errorMessage: null,
        },
      }),
      prisma.draft.create({
        data: {
          id: draftId,
          projectId,
          name: "Initial draft",
          gitBranch,
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

    await job.updateProgress(100)
    await publishProgress(projectId, { step: "complete", progress: 100 })
    await logAudit({ projectId, action: "project.scaffold_complete", metadata: { githubRepo } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scaffold failed"
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ERROR", errorMessage: message },
    })
    await publishProgress(projectId, { step: "error", error: message })
    throw err
  }
}

export async function handleGitCommit(job: Job<ProjectGitCommitJob>) {
  const { projectId, draftId, message, userId } = job.data

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const draft = await prisma.draft.findFirst({ where: { id: draftId, projectId } })

  if (!project?.workspacePath || !draft) {
    throw new Error("Project or draft not found")
  }

  await checkoutBranch(project.workspacePath, draft.gitBranch)
  let sha = draft.lastCommitSha ?? ""
  try {
    sha = await commitChanges(project.workspacePath, message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/nothing to commit|no changes added/i.test(msg)) throw err
    await job.log("No file changes — skipped new save point")
  }

  const hasGithub = githubCredentialsConfigured()
  if (hasGithub && sha) {
    await pushBranch(project.workspacePath, draft.gitBranch)
  }

  const pages = await readPagesConfig(project.workspacePath).catch(() => [])

  await prisma.draft.update({
    where: { id: draftId },
    data: { lastCommitSha: sha, pagesConfigSnapshot: pages as object },
  })

  await logAudit({ userId, projectId, action: "draft.commit", metadata: { draftId, sha } })
  await publishProgress(projectId, { step: "draft_saved", draftId, sha })
}

export async function handlePublish(job: Job<ProjectPublishJob>) {
  const { projectId, draftId, mergeToMain, releaseNotes, userId } = job.data

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const draft = await prisma.draft.findFirst({ where: { id: draftId, projectId } })

  if (!project?.workspacePath || !draft) {
    throw new Error("Project or draft not found")
  }

  const lastDeployment = await prisma.deployment.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  })

  let version = "v0.1.0"
  if (lastDeployment?.tag) {
    const match = lastDeployment.tag.match(/v(\d+)\.(\d+)\.(\d+)/)
    if (match) {
      version = `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`
    }
  }

  await checkoutBranch(project.workspacePath, draft.gitBranch)

  const hasGithub = githubCredentialsConfigured()
  if (hasGithub) {
    await pushBranch(project.workspacePath, draft.gitBranch)
  }

  if (mergeToMain) {
    await mergeBranch(project.workspacePath, draft.gitBranch, "main")
    const hasGithubMerge = githubCredentialsConfigured()
    if (hasGithubMerge) {
      await pushBranch(project.workspacePath, "main")
    }
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      tag: version,
      status: "PENDING",
      releaseNotes,
    },
  })

  const hasGithubTag = githubCredentialsConfigured()
  if (hasGithubTag) {
    await createTag(project.workspacePath, version, releaseNotes)
  }

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { status: "BUILDING" },
  })

  await logAudit({
    userId,
    projectId,
    action: "project.published",
    metadata: { tag: version, mergeToMain },
  })

  await publishProgress(projectId, { step: "published", tag: version, deploymentId: deployment.id })
}

export async function handleGithubProvision(job: Job<ProjectGithubProvisionJob>) {
  const { projectId, userId } = job.data

  try {
    if (!githubCredentialsConfigured()) {
      throw new Error(
        "GitHub App not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env and restart the worker."
      )
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project?.workspacePath) {
      throw new Error("Project workspace not found — wait for scaffold to finish")
    }

    const repoPath = project.workspacePath
    await publishProgress(projectId, { step: "github_provision", progress: 20 })

    const repo = await getOrCreateProjectRepo(projectId)
    const authCloneUrl = await getAuthenticatedCloneUrl(repo.cloneUrl)

    const releaseTemplate = join(process.cwd(), "templates", "project-release.yml")
    if (existsSync(releaseTemplate)) {
      await mkdir(join(repoPath, ".github", "workflows"), { recursive: true })
      await cp(releaseTemplate, join(repoPath, ".github", "workflows", "release.yml"))
    }

    await publishProgress(projectId, { step: "github_push", progress: 50 })

    try {
      await pushRepoToRemote(repoPath, authCloneUrl, "main", "chore: scaffold storefront")
    } catch (pushErr) {
      const detail = pushErr instanceof Error ? pushErr.message : "git push failed"
      throw new Error(`Repository created but push failed: ${detail}`)
    }

    await protectMainBranch(getRepoName(projectId))

    const draft = await prisma.draft.findFirst({
      where: { projectId, isActive: true },
    })
    if (draft) {
      try {
        await pushBranch(repoPath, draft.gitBranch)
      } catch {
        // draft branch may not exist on remote yet
      }
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        githubRepo: repo.fullName,
        githubRepoId: repo.repoId,
        errorMessage: null,
      },
    })

    await logAudit({
      userId,
      projectId,
      action: "project.github_provisioned",
      metadata: { githubRepo: repo.fullName, created: repo.created },
    })

    await publishProgress(projectId, {
      step: "github_complete",
      progress: 100,
      githubRepo: repo.fullName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : formatGithubError(err)
    await prisma.project.update({
      where: { id: projectId },
      data: { errorMessage: message },
    })
    await publishProgress(projectId, { step: "github_error", error: message })
    throw err
  }
}

export async function handleLocalRun(job: Job<import("@mwb/core/queue").ProjectLocalRunJob>) {
  const { projectId, slug, action } = job.data
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  if (!project.workspacePath) throw new Error("Shop not scaffolded")

  const { setProjectLocalRun, startBackendLocal, startStorefrontLocal, stopShopLocal } =
    await import("@mwb/core/shops")

  const pickUpMessage =
    action === "start"
      ? "Worker picked up backend start job…"
      : action === "start-storefront"
        ? "Worker picked up storefront start job…"
        : "Worker picked up stop job…"

  await setProjectLocalRun(projectId, {
    slug,
    status: action === "stop" ? "stopping" : "starting",
    backendPort: 9000,
    storefrontPort: 8000,
    message: pickUpMessage,
    action,
    phase: "active",
    jobId: String(job.id),
  })

  // Extend BullMQ lock while npm install / health checks run (can take several minutes)
  const keepAlive = setInterval(() => {
    void job.updateProgress({ ts: Date.now() }).catch(() => {})
  }, 20_000)

  try {
    await publishProgress(projectId, {
      step:
        action === "stop"
          ? "local_stopping"
          : action === "start-storefront"
            ? "local_starting_storefront"
            : "local_starting",
      progress: 10,
    })

    const state =
      action === "start"
        ? await startBackendLocal(project.workspacePath, slug, projectId)
        : action === "start-storefront"
          ? await startStorefrontLocal(project.workspacePath, slug, projectId)
          : await stopShopLocal(project.workspacePath, slug, projectId)

    await publishProgress(projectId, {
      step: action === "stop" ? "local_stopped" : "local_status",
      progress: 100,
      localRun: state,
    })

    if ((action === "start" || action === "start-storefront") && state.status === "error") {
      throw new Error(state.message ?? "Local start failed")
    }
  } finally {
    clearInterval(keepAlive)
  }
}
