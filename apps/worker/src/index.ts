import { loadRootEnv } from "../../../scripts/load-env.mjs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

loadRootEnv(join(dirname(fileURLToPath(import.meta.url)), "../../.."))

import { createWorker, QUEUE_NAMES } from "@mwb/core/queue"
import { handleScaffold, handleGitCommit, handlePublish, handleGithubProvision } from "./handlers/project"
import { handleRegistrySync } from "./handlers/registry"
import { handleDeploy } from "./handlers/deploy"
import { syncDefaultStorefrontComponents, syncDefaultPlugins } from "@mwb/registry"

console.log("Starting Medusa Web Builder worker...")
console.log("Queue broker: REDIS_URL =", process.env.REDIS_URL ?? "redis://localhost:6379")
console.log("Job queues:")
console.log("  project  → scaffold | git.commit | publish | github.provision")
console.log("  registry → sections | plugins | github-repo | github-plugins-repo | refresh-versions")
console.log("  deploy   → trigger (DEPLOY_WEBHOOK_URL =", process.env.DEPLOY_WEBHOOK_URL ?? "(not set)", ")")
console.log("GitHub App configured:", !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY))

const projectWorker = createWorker(
  QUEUE_NAMES.project,
  async (job) => {
    console.log(`Processing project job: ${job.name} (${job.id})`)
    switch (job.name) {
      case "scaffold":
        return handleScaffold(job as Parameters<typeof handleScaffold>[0])
      case "git.commit":
        return handleGitCommit(job as Parameters<typeof handleGitCommit>[0])
      case "publish":
        return handlePublish(job as Parameters<typeof handlePublish>[0])
      case "github.provision":
        return handleGithubProvision(job as Parameters<typeof handleGithubProvision>[0])
      default:
        throw new Error(`Unknown project job: ${job.name}`)
    }
  },
  2
)

const registryWorker = createWorker(
  QUEUE_NAMES.registry,
  async (job) => {
    console.log(`Processing registry job: ${job.name} (${job.id})`)
    return handleRegistrySync(job as Parameters<typeof handleRegistrySync>[0])
  },
  1
)

const deployWorker = createWorker(
  QUEUE_NAMES.deploy,
  async (job) => {
    console.log(`Processing deploy job: ${job.name} (${job.id})`)
    return handleDeploy(job as Parameters<typeof handleDeploy>[0])
  },
  3
)

for (const worker of [projectWorker, registryWorker, deployWorker]) {
  worker.on("completed", (job) => console.log(`Job ${job.id} completed`))
  worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err))
}

async function bootstrap() {
  try {
    const sections = await syncDefaultStorefrontComponents()
    const plugins = await syncDefaultPlugins()
    console.log(`Bootstrapped registry: ${sections} sections, ${plugins} plugins`)
  } catch (err) {
    console.warn("Registry bootstrap skipped (DB may not be ready):", err)
  }
}

bootstrap()
console.log("Workers listening on queues:", Object.values(QUEUE_NAMES).join(", "))
