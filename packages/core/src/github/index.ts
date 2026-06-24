import { createPrivateKey } from "crypto"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

const GITHUB_ORG = process.env.GITHUB_ORG ?? "medusa-storefronts"

/** Normalize PEM from .env (quoted string with \\n, or multiline). */
export function normalizeGithubPrivateKey(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  let key = raw.trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\n/g, "\n").trim()
  if (!key.includes("BEGIN")) return null
  return key
}

export function validateGithubPrivateKey(key: string): { ok: true } | { ok: false; error: string } {
  try {
    createPrivateKey(key)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/DECODER|unsupported|PEM|private key/i.test(msg)) {
      return {
        ok: false,
        error:
          "The cloud storage private key in server settings is invalid or corrupted. " +
          "Re-paste the PEM key as a single line with \\n for line breaks, or leave GITHUB_APP_PRIVATE_KEY empty to run without cloud backup.",
      }
    }
    return { ok: false, error: msg }
  }
}

function getGithubPrivateKey(): string {
  const key = normalizeGithubPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY)
  if (!key) {
    throw new Error("GITHUB_APP_PRIVATE_KEY is missing or malformed")
  }
  const validation = validateGithubPrivateKey(key)
  if (!validation.ok) {
    throw new Error(validation.error)
  }
  return key
}

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
  const token = await getInstallationAccessToken()
  return new Octokit({ auth: token })
}

async function getInstallationId(
  auth: ReturnType<typeof createAppAuth>
): Promise<number> {
  const jwt = await auth({ type: "app" })
  const octokit = new Octokit({ auth: jwt.token })
  const { data } = await octokit.rest.apps.listInstallations()
  const installation = data.find((i) => i.account?.login === GITHUB_ORG)
  if (!installation) {
    const accounts = data
      .map((i) => (i.account?.login ? `${i.account.login} (${i.account.type})` : null))
      .filter(Boolean)
    const hint =
      accounts.length > 0
        ? ` App is installed on: ${accounts.join(", ")}. Install it on org "${GITHUB_ORG}" or set GITHUB_ORG.`
        : ` Install the app on https://github.com/organizations/${GITHUB_ORG}/settings/installations`
    throw new Error(`GitHub App not installed on org ${GITHUB_ORG}.${hint}`)
  }
  return installation.id
}

async function getInstallationAccessToken(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = getGithubPrivateKey()

  if (!appId) {
    throw new Error("GITHUB_APP_ID is required")
  }

  const auth = createAppAuth({ appId, privateKey })
  const installationAuth = await auth({
    type: "installation",
    installationId: await getInstallationId(auth),
  })
  return installationAuth.token
}

export type GithubInstallationStatus = {
  configured: boolean
  installed: boolean
  org: string
  appSlug?: string
  installationId?: number
  availableInstallations: Array<{ login: string; type: string }>
  error?: string
  installUrl: string
}

/** Verify credentials exist and the app is installed on GITHUB_ORG. */
export async function getGithubInstallationStatus(): Promise<GithubInstallationStatus> {
  const defaultInstallUrl = `https://github.com/organizations/${GITHUB_ORG}/settings/installations`

  if (!githubCredentialsConfigured()) {
    const rawKey = normalizeGithubPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY)
    let error = "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are not set"
    if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY) {
      if (!rawKey) {
        error = "GITHUB_APP_PRIVATE_KEY is missing or malformed"
      } else {
        const validation = validateGithubPrivateKey(rawKey)
        error = validation.ok ? error : validation.error
      }
    }
    return {
      configured: false,
      installed: false,
      org: GITHUB_ORG,
      availableInstallations: [],
      installUrl: defaultInstallUrl,
      error,
    }
  }

  try {
    const appId = process.env.GITHUB_APP_ID!
    const privateKey = getGithubPrivateKey()
    const auth = createAppAuth({ appId, privateKey })
    const jwt = await auth({ type: "app" })
    const octokit = new Octokit({ auth: jwt.token })

    const { data: app } = await octokit.rest.apps.getAuthenticated()
    const appSlug = app?.slug ?? "medusa-web-builder"
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`

    const { data } = await octokit.rest.apps.listInstallations()

    const availableInstallations = data
      .map((i) => ({
        login: i.account?.login ?? "unknown",
        type: i.account?.type ?? "unknown",
      }))
      .filter((i) => i.login !== "unknown")

    const installation = data.find((i) => i.account?.login === GITHUB_ORG)
    if (!installation) {
      const on = availableInstallations.map((a) => `${a.login} (${a.type})`).join(", ")
      return {
        configured: true,
        installed: false,
        org: GITHUB_ORG,
        appSlug,
        availableInstallations,
        installUrl,
        error: on
          ? `GitHub App is not installed on org "${GITHUB_ORG}". It is installed on: ${on}. Install it on the org or set GITHUB_ORG to match.`
          : `GitHub App is not installed on org "${GITHUB_ORG}". Install it from your GitHub App settings.`,
      }
    }

    return {
      configured: true,
      installed: true,
      org: GITHUB_ORG,
      appSlug,
      installationId: installation.id,
      availableInstallations,
      installUrl,
    }
  } catch (err) {
    return {
      configured: true,
      installed: false,
      org: GITHUB_ORG,
      availableInstallations: [],
      installUrl: defaultInstallUrl,
      error: formatGithubError(err),
    }
  }
}

/** HTTPS clone URL with installation token for git push from the worker. */
export async function getAuthenticatedCloneUrl(cloneUrl: string): Promise<string> {
  const token = await getInstallationAccessToken()
  const url = new URL(cloneUrl)
  url.username = "x-access-token"
  url.password = token
  return url.toString()
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
  const appId = process.env.GITHUB_APP_ID
  const key = normalizeGithubPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY)
  if (!appId || !key) return false
  return validateGithubPrivateKey(key).ok
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

  if (e.message) {
    if (/DECODER|unsupported|PEM|private key/i.test(e.message)) {
      return (
        "Cloud storage private key is invalid. Re-paste GITHUB_APP_PRIVATE_KEY in .env " +
        "(single line with \\n for line breaks), or remove it to run without cloud backup."
      )
    }
    return e.message
  }
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
