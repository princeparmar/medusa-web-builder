/// <reference path="./tweetsodium.d.ts" />
import sodium from "tweetsodium"
import { getOctokit, parseRepoFullName } from "./index"

export type GithubSecretInfo = {
  name: string
  updatedAt: string | null
}

export type GithubVariableInfo = {
  name: string
  value: string
  updatedAt: string | null
}

function encryptSecret(value: string, publicKey: string): string {
  const messageBytes = Buffer.from(value)
  const keyBytes = Buffer.from(publicKey, "base64")
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes)
  return Buffer.from(encryptedBytes).toString("base64")
}

export async function listRepoSecrets(repoFullName: string): Promise<GithubSecretInfo[]> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  const { data } = await octokit.rest.actions.listRepoSecrets({ owner, repo, per_page: 100 })
  return data.secrets.map((s) => ({ name: s.name, updatedAt: s.updated_at }))
}

export async function createOrUpdateRepoSecret(
  repoFullName: string,
  name: string,
  value: string
): Promise<void> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  const { data: key } = await octokit.rest.actions.getRepoPublicKey({ owner, repo })
  const encrypted_value = encryptSecret(value, key.key)
  await octokit.rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: name,
    encrypted_value,
    key_id: key.key_id,
  })
}

export async function deleteRepoSecret(repoFullName: string, name: string): Promise<void> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  await octokit.rest.actions.deleteRepoSecret({ owner, repo, secret_name: name })
}

export async function listRepoVariables(repoFullName: string): Promise<GithubVariableInfo[]> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  const { data } = await octokit.rest.actions.listRepoVariables({ owner, repo, per_page: 100 })
  return data.variables.map((v) => ({
    name: v.name,
    value: v.value,
    updatedAt: v.updated_at,
  }))
}

export async function createRepoVariable(
  repoFullName: string,
  name: string,
  value: string
): Promise<void> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  await octokit.rest.actions.createRepoVariable({ owner, repo, name, value })
}

export async function updateRepoVariable(
  repoFullName: string,
  name: string,
  value: string
): Promise<void> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  await octokit.rest.actions.updateRepoVariable({ owner, repo, name, value })
}

export async function deleteRepoVariable(repoFullName: string, name: string): Promise<void> {
  const octokit = await getOctokit()
  const { owner, repo } = parseRepoFullName(repoFullName)
  await octokit.rest.actions.deleteRepoVariable({ owner, repo, name })
}
