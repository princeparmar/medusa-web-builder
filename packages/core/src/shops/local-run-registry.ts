import { getRedisConnection } from "../queue/index"

export type ProjectLocalRunRecord = {
  projectId: string
  slug: string
  status: "stopped" | "starting" | "stopping" | "backend_running" | "running" | "error"
  backendPort: number
  storefrontPort: number
  message?: string
  startedAt?: string
  action?: "start" | "start-storefront" | "stop"
  phase?: "queued" | "active" | "completed" | "failed"
  jobId?: string
  updatedAt: string
}

/** @deprecated Use ProjectLocalRunRecord */
export type WorkerLocalRunRecord = ProjectLocalRunRecord

const KEY_PREFIX = "mwb:local-run:"
const INDEX_KEY = "mwb:local-run:index"
const TTL_SEC = 60 * 60 * 24

function recordKey(projectId: string) {
  return `${KEY_PREFIX}${projectId}`
}

export async function setProjectLocalRun(
  projectId: string,
  patch: Partial<ProjectLocalRunRecord> & { slug: string }
) {
  const redis = getRedisConnection()
  const existing = await getProjectLocalRun(projectId)
  const record: ProjectLocalRunRecord = {
    projectId,
    slug: patch.slug,
    status: patch.status ?? existing?.status ?? "stopped",
    backendPort: patch.backendPort ?? existing?.backendPort ?? 9000,
    storefrontPort: patch.storefrontPort ?? existing?.storefrontPort ?? 8000,
    message: patch.message ?? existing?.message,
    startedAt: patch.startedAt ?? existing?.startedAt,
    action: patch.action ?? existing?.action,
    phase: patch.phase ?? existing?.phase,
    jobId: patch.jobId ?? existing?.jobId,
    updatedAt: new Date().toISOString(),
  }
  await redis.set(recordKey(projectId), JSON.stringify(record), "EX", TTL_SEC)
  if (record.status !== "stopped") {
    await redis.sadd(INDEX_KEY, projectId)
  } else {
    await redis.srem(INDEX_KEY, projectId)
  }
  return record
}

export async function getProjectLocalRun(projectId: string): Promise<ProjectLocalRunRecord | null> {
  const redis = getRedisConnection()
  const raw = await redis.get(recordKey(projectId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ProjectLocalRunRecord
  } catch {
    return null
  }
}

export async function clearProjectLocalRun(projectId: string) {
  const redis = getRedisConnection()
  await redis.del(recordKey(projectId))
  await redis.srem(INDEX_KEY, projectId)
}

export async function listProjectLocalRuns(): Promise<ProjectLocalRunRecord[]> {
  const redis = getRedisConnection()
  const ids = await redis.smembers(INDEX_KEY)
  if (ids.length === 0) return []

  const keys = ids.map(recordKey)
  const values = await redis.mget(...keys)
  const out: ProjectLocalRunRecord[] = []

  for (let i = 0; i < ids.length; i++) {
    const raw = values[i]
    if (!raw) {
      await redis.srem(INDEX_KEY, ids[i])
      continue
    }
    try {
      out.push(JSON.parse(raw) as ProjectLocalRunRecord)
    } catch {
      await redis.srem(INDEX_KEY, ids[i])
    }
  }

  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** @deprecated Use setProjectLocalRun */
export const setWorkerLocalRun = setProjectLocalRun
/** @deprecated Use getProjectLocalRun */
export const getWorkerLocalRun = getProjectLocalRun
/** @deprecated Use clearProjectLocalRun */
export const clearWorkerLocalRun = clearProjectLocalRun
/** @deprecated Use listProjectLocalRuns */
export const listWorkerLocalRuns = listProjectLocalRuns
