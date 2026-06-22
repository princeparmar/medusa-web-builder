import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq"
import IORedis from "ioredis"

export const QUEUE_NAMES = {
  project: "project",
  registry: "registry",
  deploy: "deploy",
} as const

export type ProjectJobName = "scaffold" | "git.commit" | "publish" | "github.provision"
export type RegistryJobName = "sync.sections" | "sync.plugins" | "sync.github-repo"
export type DeployJobName = "trigger"

export type ProjectScaffoldJob = {
  projectId: string
  preset: string
  defaultRegion?: string
}

export type ProjectGitCommitJob = {
  projectId: string
  draftId: string
  message: string
  userId: string
}

export type ProjectPublishJob = {
  projectId: string
  draftId: string
  mergeToMain: boolean
  releaseNotes: string
  userId: string
}

export type ProjectGithubProvisionJob = {
  projectId: string
  userId: string
}

export type RegistrySyncJob = {
  type: "sections" | "plugins" | "github-repo" | "github-plugins-repo" | "refresh-versions"
  githubRepo?: string
  branch?: string
}

export type DeployTriggerJob = {
  projectId: string
  tag: string
  releaseUrl?: string
}

let redisConnection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    })
  }
  return redisConnection
}

export function getConnectionOptions(): ConnectionOptions {
  return getRedisConnection() as unknown as ConnectionOptions
}

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getConnectionOptions() })
}

export function createWorker<T>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 2
): Worker<T> {
  return new Worker(name, processor, {
    connection: getConnectionOptions(),
    concurrency,
  })
}

export async function enqueueProjectJob(
  jobName: ProjectJobName,
  data: ProjectScaffoldJob | ProjectGitCommitJob | ProjectPublishJob | ProjectGithubProvisionJob,
  jobId?: string
) {
  const queue = createQueue(QUEUE_NAMES.project)
  return queue.add(jobName, data, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  })
}

export async function enqueueRegistryJob(data: RegistrySyncJob, jobId?: string) {
  const queue = createQueue(QUEUE_NAMES.registry)
  return queue.add(data.type, data, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  })
}

export async function enqueueDeployJob(data: DeployTriggerJob, jobId?: string) {
  const queue = createQueue(QUEUE_NAMES.deploy)
  return queue.add("trigger", data, {
    jobId: jobId ?? `deploy-${data.projectId}-${data.tag}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  })
}
