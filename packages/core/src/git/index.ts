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

export async function initAndPush(params: {
  repoPath: string
  remoteUrl: string
  branch?: string
  message?: string
}): Promise<void> {
  const git = await prepareRepo(params.repoPath)
  const branch = params.branch ?? "main"

  await git.init()
  await git.add(".")
  await git.commit(params.message ?? "chore: initial commit")
  await git.addRemote("origin", params.remoteUrl)
  await git.push("origin", branch, ["--set-upstream"])
}

/** Push an existing local repo to GitHub (adds origin if missing). */
export async function pushExistingRepoToRemote(
  repoPath: string,
  remoteUrl: string,
  branch = "main"
): Promise<void> {
  const git = await prepareRepo(repoPath)
  const remotes = await git.getRemotes()
  if (!remotes.find((r) => r.name === "origin")) {
    await git.addRemote("origin", remoteUrl)
  } else {
    await git.remote(["set-url", "origin", remoteUrl])
  }
  await git.push("origin", branch, ["--set-upstream"])
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
