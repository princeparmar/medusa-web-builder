import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

const GITHUB_ORG = process.env.GITHUB_ORG ?? "medusa-storefronts"

export function getGithubOrg(): string {
  return GITHUB_ORG
}

export function getRepoName(projectId: string): string {
  return `storefront-${projectId}`
}

export function getFullRepoName(projectId: string): string {
  return `${GITHUB_ORG}/${getRepoName(projectId)}`
}

export async function getOctokit(): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required")
  }

  const auth = createAppAuth({ appId, privateKey })
  const installationAuth = await auth({
    type: "installation",
    installationId: await getInstallationId(auth),
  })
  return new Octokit({ auth: installationAuth.token })
}

async function getInstallationId(
  auth: ReturnType<typeof createAppAuth>
): Promise<number> {
  const jwt = await auth({ type: "app" })
  const octokit = new Octokit({ auth: jwt.token })
  const { data } = await octokit.rest.apps.listInstallations()
  const installation = data.find((i) => i.account?.login === GITHUB_ORG)
  if (!installation) {
    throw new Error(`GitHub App not installed on org ${GITHUB_ORG}`)
  }
  return installation.id
}

export async function createProjectRepo(projectId: string): Promise<{
  repoId: number
  fullName: string
  cloneUrl: string
}> {
  const octokit = await getOctokit()
  const name = getRepoName(projectId)

  try {
    const { data } = await octokit.rest.repos.createInOrg({
      org: GITHUB_ORG,
      name,
      private: true,
      auto_init: false,
      description: `Medusa storefront project ${projectId}`,
    })

    return {
      repoId: data.id,
      fullName: data.full_name,
      cloneUrl: data.clone_url,
    }
  } catch (err) {
    throw new Error(formatGithubError(err))
  }
}

export async function getOrCreateProjectRepo(projectId: string): Promise<{
  repoId: number
  fullName: string
  cloneUrl: string
  created: boolean
}> {
  const octokit = await getOctokit()
  const name = getRepoName(projectId)

  try {
    const { data } = await octokit.rest.repos.get({ owner: GITHUB_ORG, repo: name })
    return {
      repoId: data.id,
      fullName: data.full_name,
      cloneUrl: data.clone_url,
      created: false,
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 404) {
      try {
        const created = await createProjectRepo(projectId)
        return { ...created, created: true }
      } catch (createErr) {
        throw new Error(formatGithubError(createErr))
      }
    }
    throw new Error(formatGithubError(err))
  }
}

export async function protectMainBranch(repoName: string): Promise<void> {
  const octokit = await getOctokit()
  try {
    await octokit.rest.repos.updateBranchProtection({
      owner: GITHUB_ORG,
      repo: repoName,
      branch: "main",
      required_status_checks: null,
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
    })
  } catch {
    // Branch protection may fail if branch doesn't exist yet
  }
}

export async function createReleaseTag(
  repoName: string,
  tag: string,
  targetSha: string,
  notes: string
): Promise<string> {
  const octokit = await getOctokit()
  await octokit.rest.git.createRef({
    owner: GITHUB_ORG,
    repo: repoName,
    ref: `refs/tags/${tag}`,
    sha: targetSha,
  })
  const { data } = await octokit.rest.repos.createRelease({
    owner: GITHUB_ORG,
    repo: repoName,
    tag_name: tag,
    name: `Release ${tag}`,
    body: notes,
    target_commitish: targetSha,
  })
  return data.html_url
}

export type GithubWorkflowRunInfo = {
  id: number
  tag: string
  workflowName: string
  status: string
  conclusion: string | null
  htmlUrl: string
  createdAt: string
  updatedAt: string
  releaseUrl?: string
  event: string
}

export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/")
  if (!owner || !repo) throw new Error(`Invalid repo name: ${fullName}`)
  return { owner, repo }
}

export function extractTagFromWorkflowRun(run: {
  display_title?: string | null
  head_branch?: string | null
  id: number
}): string {
  const title = run.display_title ?? ""
  const branch = run.head_branch ?? ""
  const fromTitle = title.match(/v\d+\.\d+\.\d+/)?.[0]
  if (fromTitle) return fromTitle
  if (branch && /^v\d/.test(branch)) return branch
  if (branch && /^\d+\.\d+\.\d+/.test(branch)) return `v${branch}`
  if (title.startsWith("v")) return title.split(/\s/)[0] ?? title
  return title || `run-${run.id}`
}

export function githubCredentialsConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY)
}

/** Turn Octokit / GitHub API errors into a user-readable message. */
export function formatGithubError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Unknown GitHub error"
  }

  const e = err as {
    status?: number
    message?: string
    response?: {
      data?: {
        message?: string
        documentation_url?: string
        errors?: Array<{ message?: string; resource?: string; field?: string }>
      }
    }
  }

  const status = e.status
  const apiMessage = e.response?.data?.message
  const details = e.response?.data?.errors
    ?.map((x) => x.message || (x.field ? `${x.field}: ${x.resource}` : null))
    .filter(Boolean)
    .join("; ")

  if (apiMessage) {
    const prefix = status ? `GitHub API error (${status})` : "GitHub API error"
    const hint = formatGithubErrorHint(status, apiMessage)
    return [prefix + `: ${apiMessage}`, details, hint].filter(Boolean).join(" — ")
  }

  if (e.message) return e.message
  return "GitHub request failed"
}

function formatGithubErrorHint(status: number | undefined, apiMessage: string): string | null {
  const lower = apiMessage.toLowerCase()
  if (status === 401 || lower.includes("bad credentials")) {
    return "Check GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env"
  }
  if (status === 403 || lower.includes("resource not accessible")) {
    return "Install the GitHub App on the org and grant Administration + Contents (read/write)"
  }
  if (status === 404 && lower.includes("installation")) {
    return `Install the GitHub App on organization ${GITHUB_ORG}`
  }
  if (status === 422 && lower.includes("already exists")) {
    return "Repository name is taken — contact support or delete the existing repo"
  }
  if (status === 404) {
    return `Verify organization ${GITHUB_ORG} exists and the app is installed`
  }
  return null
}

export async function listReleaseWorkflowRuns(
  repoFullName: string,
  limit = 50
): Promise<GithubWorkflowRunInfo[]> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)

  const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({ owner, repo })
  const releaseWorkflow = workflows.workflows.find(
    (w) => w.path === ".github/workflows/release.yml" || w.name === "Release Build"
  )
  if (!releaseWorkflow) return []

  const { data: runsData } = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: releaseWorkflow.id,
    per_page: limit,
  })

  const { data: releases } = await octokit.rest.repos.listReleases({ owner, repo, per_page: limit })
  const releaseByTag = new Map(releases.map((r) => [r.tag_name, r.html_url]))

  return runsData.workflow_runs.map((run) => {
    const tag = extractTagFromWorkflowRun(run)
    return {
      id: run.id,
      tag,
      workflowName: run.name ?? releaseWorkflow.name,
      status: run.status ?? "unknown",
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      releaseUrl: releaseByTag.get(tag),
      event: run.event ?? "unknown",
    }
  })
}

export function workflowRunToDeploymentStatus(
  status: string,
  conclusion: string | null
): "PENDING" | "BUILDING" | "LIVE" | "FAILED" {
  if (status === "queued" || status === "waiting" || status === "requested") return "PENDING"
  if (status === "in_progress") return "BUILDING"
  if (status === "completed") {
    if (conclusion === "success") return "LIVE"
    if (conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out") return "FAILED"
  }
  return "BUILDING"
}
