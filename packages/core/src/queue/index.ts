import { Queue, Worker, type Job, type ConnectionOptions, type WorkerOptions } from "bullmq"
import IORedis from "ioredis"

export const QUEUE_NAMES = {
  project: "project",
  registry: "registry",
  deploy: "deploy",
} as const

export type ProjectJobName = "scaffold" | "git.commit" | "publish" | "github.provision" | "local.start" | "local.start-storefront" | "local.stop"
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

export type ProjectLocalRunJob = {
  projectId: string
  slug: string
  action: "start" | "start-storefront" | "stop"
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
  concurrency = 2,
  workerOptions?: Omit<WorkerOptions, "connection" | "concurrency">
): Worker<T> {
  return new Worker(name, processor, {
    connection: getConnectionOptions(),
    concurrency,
    ...workerOptions,
  })
}

export async function enqueueProjectJob(
  jobName: ProjectJobName,
  data:
    | ProjectScaffoldJob
    | ProjectGitCommitJob
    | ProjectPublishJob
    | ProjectGithubProvisionJob
    | ProjectLocalRunJob,
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

const WORKER_HEARTBEAT_KEY = "mwb:worker:heartbeat"
const WORKER_HEARTBEAT_TTL_SEC = 45

export async function touchWorkerHeartbeat() {
  const redis = getRedisConnection()
  await redis.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", WORKER_HEARTBEAT_TTL_SEC)
}

export async function getWorkerHealth(): Promise<{
  online: boolean
  lastSeenMs: number | null
  redisUrl: string
}> {
  const redis = getRedisConnection()
  try {
    await redis.ping()
  } catch {
    return { online: false, lastSeenMs: null, redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379" }
  }
  const raw = await redis.get(WORKER_HEARTBEAT_KEY)
  const lastSeenMs = raw ? Number(raw) : null
  const online = lastSeenMs !== null && Date.now() - lastSeenMs < WORKER_HEARTBEAT_TTL_SEC * 1000
  return { online, lastSeenMs, redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379" }
}

export async function cancelProjectLocalJobs(projectId: string) {
  const queue = createQueue(QUEUE_NAMES.project)
  const jobs = await queue.getJobs(["waiting", "delayed", "active"], 0, 100)
  for (const job of jobs) {
    if (
      job.name !== "local.start" &&
      job.name !== "local.start-storefront" &&
      job.name !== "local.stop"
    ) {
      continue
    }
    if ((job.data as ProjectLocalRunJob).projectId !== projectId) continue
    const state = await job.getState()
    if (state === "active") {
      await job.moveToFailed(new Error("Cancelled by user"), "0").catch(() => {})
    } else {
      await job.remove().catch(() => {})
    }
  }
}

export async function enqueueLocalRunJob(
  action: "start" | "start-storefront" | "stop",
  data: ProjectLocalRunJob,
  projectId: string
) {
  const queue = createQueue(QUEUE_NAMES.project)
  const jobName =
    action === "start"
      ? "local.start"
      : action === "start-storefront"
        ? "local.start-storefront"
        : "local.stop"

  if (action === "stop") {
    await cancelProjectLocalJobs(projectId)
  } else {
    const active = await queue.getJobs(["active", "waiting", "delayed"], 0, 50)
    const inFlight = active.find(
      (job) =>
        (job.name === "local.start" ||
          job.name === "local.start-storefront" ||
          job.name === "local.stop") &&
        (job.data as ProjectLocalRunJob).projectId === projectId
    )
    if (inFlight) {
      return { job: inFlight, reused: true as const }
    }
  }

  const jobId = `${jobName}-${projectId}-${Date.now()}`
  const job = await queue.add(jobName, data, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  })
  return { job, reused: false as const }
}

export async function getProjectLocalJobInFlight(projectId: string) {
  const queue = createQueue(QUEUE_NAMES.project)
  const jobs = await queue.getJobs(["active", "waiting", "delayed"], 0, 50)
  return (
    jobs.find(
      (job) =>
        (job.name === "local.start" ||
          job.name === "local.start-storefront" ||
          job.name === "local.stop") &&
        (job.data as ProjectLocalRunJob).projectId === projectId
    ) ?? null
  )
}

export async function getProjectLocalJobStatus(projectId: string) {
  const job = await getProjectLocalJobInFlight(projectId)
  if (!job) return null
  return { id: job.id, name: job.name, state: await job.getState() }
}

export type QueueJobSummary = {
  queue: string
  id: string
  name: string
  state: string
  projectId?: string
  slug?: string
  data: unknown
  timestamp: number
}

export async function listQueueJobs(limit = 80): Promise<QueueJobSummary[]> {
  const queueNames = Object.values(QUEUE_NAMES)
  const out: QueueJobSummary[] = []

  for (const queueName of queueNames) {
    const queue = createQueue(queueName)
    const jobs = await queue.getJobs(["active", "waiting", "delayed"], 0, limit)
    for (const job of jobs) {
      const data = job.data as { projectId?: string; slug?: string }
      out.push({
        queue: queueName,
        id: String(job.id),
        name: job.name,
        state: await job.getState(),
        projectId: data.projectId,
        slug: data.slug,
        data: job.data,
        timestamp: job.timestamp,
      })
    }
  }

  return out.sort((a, b) => b.timestamp - a.timestamp)
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
