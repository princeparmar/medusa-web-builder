import { mkdir } from "fs/promises"
import { join, resolve } from "path"
import simpleGit, { type SimpleGit } from "simple-git"

export function getWorkspaceRoot(): string {
  const root = process.env.WORKSPACE_ROOT ?? "./workspaces"
  return resolve(root)
}

export function getProjectWorkspacePath(projectId: string): string {
  return join(getWorkspaceRoot(), projectId)
}

export function getProjectRepoPath(projectId: string): string {
  return join(getProjectWorkspacePath(projectId), `storefront-${projectId}`)
}

export async function ensureWorkspaceDir(projectId: string): Promise<string> {
  const dir = getProjectWorkspacePath(projectId)
  await mkdir(dir, { recursive: true })
  return dir
}

export function openRepo(repoPath: string): SimpleGit {
  const name = process.env.GIT_USER_NAME ?? "Medusa Web Builder"
  const email = process.env.GIT_USER_EMAIL ?? "builder@medusa-web-builder.local"
  return simpleGit(repoPath, {
    config: [`user.name=${name}`, `user.email=${email}`],
  })
}

export async function prepareRepo(repoPath: string): Promise<SimpleGit> {
  return openRepo(repoPath)
}

function isOriginExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /remote origin already exists/i.test(msg)
}

/** Set origin URL, adding the remote first when missing. Safe to call repeatedly. */
async function ensureOriginRemote(git: SimpleGit, remoteUrl: string): Promise<void> {
  try {
    await git.remote(["set-url", "origin", remoteUrl])
    return
  } catch {
    // origin not configured yet
  }

  try {
    await git.addRemote("origin", remoteUrl)
  } catch (err) {
    if (isOriginExistsError(err)) {
      await git.remote(["set-url", "origin", remoteUrl])
      return
    }
    throw err
  }
}

async function ensureRepoInitialized(git: SimpleGit): Promise<void> {
  const isRepo = await git.checkIsRepo()
  if (!isRepo) {
    await git.init()
  }
}

async function ensureInitialCommit(git: SimpleGit, message: string): Promise<void> {
  const log = await git.log({ maxCount: 1 }).catch(() => null)
  const status = await git.status()

  if (!log || log.total === 0) {
    await git.add(".")
    await git.commit(message)
    return
  }

  if (!status.isClean()) {
    await git.add(".")
    await git.commit(message)
  }
}

async function ensureBranch(git: SimpleGit, branch: string): Promise<void> {
  const { current } = await git.status()
  if (current === branch) return

  const branches = await git.branchLocal()
  if (branches.all.includes(branch)) {
    await git.checkout(branch)
    return
  }

  if (current) {
    await git.checkoutLocalBranch(branch)
    return
  }

  await git.checkout(branch)
}

function isBenignPushError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("Everything up-to-date") || msg.includes("already up to date")
}

/** Initialize (if needed), commit, set origin, and push to GitHub. Safe to retry. */
export async function pushRepoToRemote(
  repoPath: string,
  remoteUrl: string,
  branch = "main",
  message = "chore: scaffold storefront"
): Promise<void> {
  const git = await prepareRepo(repoPath)
  await ensureRepoInitialized(git)
  await ensureInitialCommit(git, message)
  await ensureOriginRemote(git, remoteUrl)
  await ensureBranch(git, branch)

  try {
    await git.push("origin", branch, ["--set-upstream"])
  } catch (err) {
    if (isBenignPushError(err)) return
    throw err
  }
}

export async function initAndPush(params: {
  repoPath: string
  remoteUrl: string
  branch?: string
  message?: string
}): Promise<void> {
  await pushRepoToRemote(
    params.repoPath,
    params.remoteUrl,
    params.branch ?? "main",
    params.message ?? "chore: initial commit"
  )
}

/** Push an existing local repo to GitHub (adds origin if missing). */
export async function pushExistingRepoToRemote(
  repoPath: string,
  remoteUrl: string,
  branch = "main"
): Promise<void> {
  await pushRepoToRemote(repoPath, remoteUrl, branch)
}

export async function createBranch(repoPath: string, branchName: string, fromBranch = "main"): Promise<void> {
  const git = openRepo(repoPath)
  await git.checkout(fromBranch)
  await git.checkoutLocalBranch(branchName)
}

export async function commitChanges(
  repoPath: string,
  message: string,
  files?: string[]
): Promise<string> {
  const git = await prepareRepo(repoPath)
  if (files?.length) {
    await git.add(files)
  } else {
    await git.add(".")
  }
  const result = await git.commit(message)
  return result.commit
}

export async function pushBranch(repoPath: string, branch: string): Promise<void> {
  const git = openRepo(repoPath)
  await git.push("origin", branch)
}

export async function mergeBranch(repoPath: string, sourceBranch: string, targetBranch = "main"): Promise<void> {
  const git = openRepo(repoPath)
  await git.checkout(targetBranch)
  await git.merge([sourceBranch])
}

export async function createTag(repoPath: string, tag: string, message?: string): Promise<void> {
  const git = openRepo(repoPath)
  await git.addAnnotatedTag(tag, message ?? tag)
  await git.push("origin", tag)
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = openRepo(repoPath)
  const status = await git.status()
  return status.current ?? "main"
}

export async function checkoutBranch(repoPath: string, branch: string): Promise<void> {
  const git = openRepo(repoPath)
  await git.checkout(branch)
}
