import { spawn, type ChildProcess } from "child_process"
import { join } from "path"
import { mkdir, writeFile, readFile, appendFile } from "fs/promises"
import { existsSync } from "fs"
import { promisify } from "util"
import { exec } from "child_process"
import { getProjectLocalRun, setProjectLocalRun } from "./local-run-registry"

const execAsync = promisify(exec)

export type LocalRunState = {
  status: "stopped" | "starting" | "stopping" | "backend_running" | "running" | "error"
  backendPort: number
  storefrontPort: number
  message?: string
  startedAt?: string
}

export type LocalHealthProbe = {
  backend: boolean
  storefront: boolean
  backendUrl: string
  storefrontUrl: string
}

export type LocalRunSnapshot = LocalRunState & {
  workerStatus: LocalRunState["status"]
  /** @deprecated Use workerStatus */
  savedStatus: LocalRunState["status"]
  health: LocalHealthProbe
  detectedBy: "health" | "worker"
  hold?: LocalRunHoldInfo
}

export type LocalRunHoldInfo = {
  stalled: boolean
  elapsedMs: number
  holdReason?: string
  suggestAction?: "wait" | "retry" | "stop" | "check-worker"
}

const DEFAULT_PORTS = { backendPort: 9000, storefrontPort: 8000 }

const processes = new Map<string, { backend?: ChildProcess; storefront?: ChildProcess }>()

function logPath(shopPath: string) {
  return join(shopPath, ".mwb", "local-run.log")
}

function normalizePorts(saved: Partial<LocalRunState> & { backend?: number; storefront?: number }) {
  return {
    backendPort: saved.backendPort ?? saved.backend ?? DEFAULT_PORTS.backendPort,
    storefrontPort: saved.storefrontPort ?? saved.storefront ?? DEFAULT_PORTS.storefrontPort,
  }
}

async function persistLocalRun(
  projectId: string,
  slug: string,
  state: LocalRunState,
  extra?: {
    action?: "start" | "start-storefront" | "stop"
    phase?: "queued" | "active" | "completed" | "failed"
    jobId?: string
  }
) {
  await setProjectLocalRun(projectId, { slug, ...state, ...extra })
}

export async function readLocalRunStatus(projectId: string): Promise<LocalRunState> {
  const record = await getProjectLocalRun(projectId)
  if (!record) {
    return { status: "stopped", ...DEFAULT_PORTS }
  }
  return {
    status: record.status,
    backendPort: record.backendPort,
    storefrontPort: record.storefrontPort,
    message: record.message,
    startedAt: record.startedAt,
  }
}

export async function appendLocalRunLog(shopPath: string, line: string) {
  await mkdir(join(shopPath, ".mwb"), { recursive: true })
  const ts = new Date().toISOString()
  const text = line.endsWith("\n") ? line : `${line}\n`
  await appendFile(logPath(shopPath), `[${ts}] ${text}`)
}

export async function clearLocalRunLogs(shopPath: string) {
  await mkdir(join(shopPath, ".mwb"), { recursive: true })
  await writeFile(logPath(shopPath), "")
}

export async function readLocalRunLogs(shopPath: string, maxLines = 400): Promise<string[]> {
  const path = logPath(shopPath)
  if (!existsSync(path)) return []
  const content = await readFile(path, "utf8")
  const lines = content.split("\n").filter(Boolean)
  return lines.slice(-maxLines)
}

export async function markLocalRunQueued(
  projectId: string,
  slug: string,
  shopPath: string,
  target: "backend" | "storefront" = "backend"
) {
  const label = target === "backend" ? "backend" : "storefront"
  await appendLocalRunLog(shopPath, `Local ${label} start queued — waiting for worker to pick up the job…`)
  await persistLocalRun(
    projectId,
    slug,
    {
      status: "starting",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: `Queued — waiting for worker to start ${label}…`,
      startedAt: new Date().toISOString(),
    },
    { phase: "queued", action: target === "backend" ? "start" : "start-storefront" }
  )
}

/** Align Redis status with the BullMQ job (queued vs active). */
export async function syncLocalRunWithQueue(
  projectId: string,
  slug: string,
  shopPath: string
): Promise<boolean> {
  const { getProjectLocalJobInFlight } = await import("../queue/index")
  const job = await getProjectLocalJobInFlight(projectId)
  const record = await getProjectLocalRun(projectId)
  if (!record || (record.status !== "starting" && record.status !== "stopping")) {
    return false
  }
  if (!job) {
    return false
  }

  const state = await job.getState()
  const action = (job.data as { action?: string }).action ?? record.action ?? "start"
  const label = action === "start-storefront" ? "storefront" : "backend"

  if (state === "active") {
    const keepMessage =
      record.phase === "active" &&
      record.message &&
      !record.message.includes("Queued") &&
      !record.message.includes("waiting for worker")
    await persistLocalRun(
      projectId,
      slug,
      {
        status: action === "stop" ? "stopping" : "starting",
        backendPort: record.backendPort,
        storefrontPort: record.storefrontPort,
        message: keepMessage
          ? record.message
          : action === "stop"
            ? "Worker is stopping local servers…"
            : `Worker is starting ${label}…`,
        startedAt: record.startedAt,
      },
      {
        phase: "active",
        action: action as "start" | "start-storefront" | "stop",
        jobId: String(job.id),
      }
    )
    if (record.phase === "queued") {
      await appendLocalRunLog(shopPath, `Worker picked up ${label} start job (${job.id})`)
    }
    return true
  }

  if (state === "waiting" || state === "delayed") {
    await persistLocalRun(
      projectId,
      slug,
      {
        status: "starting",
        backendPort: record.backendPort,
        storefrontPort: record.storefrontPort,
        message: `Job is in the worker queue (${state}) — will start ${label} when a slot is free…`,
        startedAt: record.startedAt,
      },
      {
        phase: "queued",
        action: action as "start" | "start-storefront" | "stop",
        jobId: String(job.id),
      }
    )
    return true
  }

  return false
}

export async function markLocalRunStopping(projectId: string, slug: string, shopPath: string) {
  await appendLocalRunLog(shopPath, "Stop requested — shutting down local servers…")
  await persistLocalRun(
    projectId,
    slug,
    {
      status: "stopping",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: "Stopping local servers…",
    },
    { action: "stop", phase: "active" }
  )
}

async function isStopRequested(projectId: string): Promise<boolean> {
  const saved = await readLocalRunStatus(projectId)
  return saved.status === "stopping" || saved.status === "stopped"
}

export async function reconcileStuckLocalRun(
  shopPath: string,
  projectId: string,
  slug: string,
  health?: LocalHealthProbe
): Promise<LocalRunState> {
  const worker = await readLocalRunStatus(projectId)
  const record = await getProjectLocalRun(projectId)
  const probe = health ?? (await probeLocalHealth(worker.backendPort, worker.storefrontPort))
  const startedAt = worker.startedAt ? Date.parse(worker.startedAt) : 0
  const ageMs = startedAt ? Date.now() - startedAt : 0

  const { getProjectLocalJobInFlight, getWorkerHealth } = await import("../queue/index")
  const inFlight = await getProjectLocalJobInFlight(projectId)
  const workerHealth = await getWorkerHealth()

  if (worker.status === "starting" && probe.backend) {
    const status = probe.storefront ? "running" : "backend_running"
    const message = probe.storefront
      ? "Backend and storefront running"
      : "Backend is healthy — ready for storefront setup"
    await persistLocalRun(projectId, slug, {
      status,
      backendPort: worker.backendPort,
      storefrontPort: worker.storefrontPort,
      message,
      startedAt: worker.startedAt,
    }, { phase: "completed", action: record?.action ?? "start" })
    return { status, backendPort: worker.backendPort, storefrontPort: worker.storefrontPort, message, startedAt: worker.startedAt }
  }

  if (worker.status === "stopping" && !probe.backend && !probe.storefront) {
    const state: LocalRunState = { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
    await persistLocalRun(projectId, slug, state, { phase: "completed", action: "stop" })
    return state
  }

  if (record?.phase === "completed" && worker.status === "starting") {
    const status = probe.storefront ? "running" : probe.backend ? "backend_running" : "stopped"
    const message =
      status === "running"
        ? "Backend and storefront running"
        : status === "backend_running"
          ? "Backend running"
          : "Stopped"
    await persistLocalRun(projectId, slug, {
      status,
      backendPort: worker.backendPort,
      storefrontPort: worker.storefrontPort,
      message,
      startedAt: worker.startedAt,
    }, { phase: "completed" })
    return { status, backendPort: worker.backendPort, storefrontPort: worker.storefrontPort, message, startedAt: worker.startedAt }
  }

  if (worker.status !== "starting" && worker.status !== "stopping") {
    return getShopLocalStatus(shopPath, projectId, slug)
  }

  if (inFlight) {
    if (worker.status === "starting" && ageMs > 360_000 && !probe.backend) {
      const message = "Backend did not become healthy within 6 minutes — check run logs, then stop and retry."
      await appendLocalRunLog(shopPath, message)
      const state: LocalRunState = {
        status: "error",
        backendPort: DEFAULT_PORTS.backendPort,
        storefrontPort: DEFAULT_PORTS.storefrontPort,
        message,
        startedAt: worker.startedAt,
      }
      await persistLocalRun(projectId, slug, state, { phase: "failed" })
      return state
    }
    return getShopLocalStatus(shopPath, projectId, slug)
  }

  if (worker.status === "stopping" && ageMs > 30_000) {
    const message = "Stop timed out — forcing stopped state."
    await appendLocalRunLog(shopPath, message)
    const state: LocalRunState = { status: "stopped", ...DEFAULT_PORTS, message }
    await persistLocalRun(projectId, slug, state, { phase: "completed", action: "stop" })
    return state
  }

  if (ageMs < 45_000) {
    return getShopLocalStatus(shopPath, projectId, slug)
  }

  const message = !workerHealth.online
    ? "Worker is offline — start it with pnpm dev:worker, then run backend again."
    : record?.phase === "queued" || worker.message?.includes("Queued")
      ? "Start never ran — no worker job in queue. Click Run backend again."
      : "Local start timed out with no active worker job. Stop, then retry."

  await appendLocalRunLog(shopPath, message)
  const state: LocalRunState = {
    status: "error",
    backendPort: DEFAULT_PORTS.backendPort,
    storefrontPort: DEFAULT_PORTS.storefrontPort,
    message,
    startedAt: worker.startedAt,
  }
  await persistLocalRun(projectId, slug, state, { phase: "failed" })
  return state
}

function attachProcessLogs(shopPath: string, proc: ChildProcess, label: string) {
  const write = (chunk: Buffer | string) => {
    const text = String(chunk).trimEnd()
    if (!text) return
    for (const line of text.split("\n")) {
      void appendLocalRunLog(shopPath, `[${label}] ${line}`)
    }
  }
  proc.stdout?.on("data", write)
  proc.stderr?.on("data", write)
  proc.on("exit", (code, signal) => {
    void appendLocalRunLog(shopPath, `[${label}] exited code=${code ?? "?"} signal=${signal ?? "none"}`)
  })
}

function backendGeneratedDir(shopPath: string) {
  return join(shopPath, "backend", ".generated-backend")
}

function storefrontGeneratedDir(shopPath: string) {
  return join(shopPath, "storefront", ".generated-app")
}

function healthUrls(port: number, pathSuffix = ""): string[] {
  return [
    `http://127.0.0.1:${port}${pathSuffix}`,
    `http://localhost:${port}${pathSuffix}`,
  ]
}

async function ensureNpmInstall(shopPath: string, dir: string, label: string) {
  if (existsSync(join(dir, "node_modules"))) return
  await appendLocalRunLog(shopPath, `Installing ${label} dependencies (npm i)…`)
  await execAsync("npm i", { cwd: dir, timeout: 300_000, maxBuffer: 10 * 1024 * 1024 })
}

type WaitForHealthOptions = {
  projectId?: string
  onProgress?: (elapsedSec: number, attempt: number) => Promise<void>
}

async function waitForHealth(
  urls: string | string[],
  attempts = 60,
  options?: WaitForHealthOptions
): Promise<boolean> {
  const targets = Array.isArray(urls) ? urls : [urls]
  const projectId = options?.projectId
  let elapsedSec = 0

  for (let i = 0; i < attempts; i++) {
    if (projectId && (await isStopRequested(projectId))) return false

    for (const url of targets) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
        if (res.ok) return true
      } catch {
        // try next host / retry
      }
    }

    if (options?.onProgress && i > 0 && i % 10 === 0) {
      await options.onProgress(elapsedSec, i)
    }

    const delayMs = i < 40 ? 1000 : 2000
    await new Promise((r) => setTimeout(r, delayMs))
    elapsedSec += Math.round(delayMs / 1000)
  }
  return false
}

async function killPort(port: number) {
  try {
    await execAsync(`lsof -ti :${port} | xargs kill -TERM 2>/dev/null || true`, { shell: "/bin/sh" })
    await new Promise((r) => setTimeout(r, 500))
    await execAsync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { shell: "/bin/sh" })
  } catch {
    // ignore
  }
}

export async function startBackendLocal(
  shopPath: string,
  slug: string,
  projectId: string
): Promise<LocalRunState> {
  if (await isStopRequested(projectId)) {
    return { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
  }

  await appendLocalRunLog(shopPath, "Worker picked up local backend start job")
  await persistLocalRun(
    projectId,
    slug,
    {
      status: "starting",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: "Starting backend (npm run dev:backend)…",
      startedAt: new Date().toISOString(),
    },
    { action: "start", phase: "active" }
  )

  const shopEnv = {
    ...process.env,
    PORT: String(DEFAULT_PORTS.backendPort),
  }

  try {
    const backendDir = join(shopPath, "backend")
    const generatedDir = backendGeneratedDir(shopPath)
    const fastBackend =
      existsSync(join(generatedDir, "package.json")) &&
      existsSync(join(generatedDir, "node_modules"))

    let backend: ChildProcess
    if (fastBackend) {
      await appendLocalRunLog(
        shopPath,
        "Fast start: medusa develop in .generated-backend (skipping rebuild, npm install & migrations)"
      )
      await persistLocalRun(
        projectId,
        slug,
        {
          status: "starting",
          backendPort: DEFAULT_PORTS.backendPort,
          storefrontPort: DEFAULT_PORTS.storefrontPort,
          message: "Starting backend (medusa develop)…",
          startedAt: (await readLocalRunStatus(projectId)).startedAt,
        },
        { action: "start", phase: "active" }
      )
      backend = spawn("npm", ["run", "dev"], {
        cwd: generatedDir,
        env: shopEnv,
        stdio: "pipe",
        detached: false,
      })
    } else {
      if (await isStopRequested(projectId)) {
        return { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
      }
      await ensureNpmInstall(shopPath, backendDir, "backend compiler")
      await appendLocalRunLog(
        shopPath,
        "First-time setup: npm run dev:backend (build, install & migrate — slower)"
      )
      await persistLocalRun(
        projectId,
        slug,
        {
          status: "starting",
          backendPort: DEFAULT_PORTS.backendPort,
          storefrontPort: DEFAULT_PORTS.storefrontPort,
          message: "First start: building backend (one-time setup)…",
          startedAt: (await readLocalRunStatus(projectId)).startedAt,
        },
        { action: "start", phase: "active" }
      )
      backend = spawn("npm", ["run", "dev:backend"], {
        cwd: shopPath,
        env: shopEnv,
        stdio: "pipe",
        detached: false,
      })
    }

    const procs: { backend?: ChildProcess; storefront?: ChildProcess } = { backend }
    processes.set(slug, procs)
    attachProcessLogs(shopPath, backend, "backend")

    await appendLocalRunLog(
      shopPath,
      `Waiting for backend health at http://127.0.0.1:${DEFAULT_PORTS.backendPort}/health`
    )
    const backendOk = await waitForHealth(
      healthUrls(DEFAULT_PORTS.backendPort, "/health"),
      fastBackend ? 90 : 120,
      {
        projectId,
        onProgress: async (elapsedSec) => {
          const mins = Math.floor(elapsedSec / 60)
          const secs = elapsedSec % 60
          const elapsed = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
          await persistLocalRun(
            projectId,
            slug,
            {
              status: "starting",
              backendPort: DEFAULT_PORTS.backendPort,
              storefrontPort: DEFAULT_PORTS.storefrontPort,
              message: fastBackend
                ? `Waiting for backend health… (${elapsed} elapsed)`
                : `First-time backend setup in progress… (${elapsed} elapsed)`,
              startedAt: (await readLocalRunStatus(projectId)).startedAt,
            },
            { action: "start", phase: "active" }
          )
        },
      }
    )
    if (!backendOk) {
      if (await isStopRequested(projectId)) {
        await stopShopLocal(shopPath, slug, projectId)
        return { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
      }
      throw new Error("Backend did not become healthy on port 9000 within 4 minutes")
    }
    await appendLocalRunLog(shopPath, "Backend is healthy")

    const { syncAutoStorefrontEnv } = await import("./env")
    await syncAutoStorefrontEnv(shopPath, slug)
    await appendLocalRunLog(shopPath, "Synced storefront env from backend")

    const state: LocalRunState = {
      status: "backend_running",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: "Backend running — configure storefront, then start it from step 2",
      startedAt: new Date().toISOString(),
    }
    await appendLocalRunLog(shopPath, state.message ?? state.status)
    await persistLocalRun(projectId, slug, state, { action: "start", phase: "completed" })
    return state
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLocalRunLog(shopPath, `FAILED: ${message}`)
    const state: LocalRunState = {
      status: "error",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message,
    }
    await persistLocalRun(projectId, slug, state, { action: "start", phase: "failed" })
    await stopShopLocal(shopPath, slug, projectId)
    return state
  }
}

/** @deprecated Use startBackendLocal */
export const startShopLocal = startBackendLocal

export async function startStorefrontLocal(
  shopPath: string,
  slug: string,
  projectId: string
): Promise<LocalRunState> {
  if (await isStopRequested(projectId)) {
    return { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
  }

  await appendLocalRunLog(shopPath, "Worker picked up local storefront start job")

  const backendOk = await waitForHealth(healthUrls(DEFAULT_PORTS.backendPort, "/health"), 3, {
    projectId,
  })
  if (!backendOk) {
    const state: LocalRunState = {
      status: "error",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: "Backend is not running — start the backend first (step 1)",
    }
    await appendLocalRunLog(shopPath, state.message ?? "Backend not running")
    await persistLocalRun(projectId, slug, state, { action: "start-storefront", phase: "failed" })
    return state
  }

  await persistLocalRun(
    projectId,
    slug,
    {
      status: "starting",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: "Starting storefront (npm run dev:storefront)…",
      startedAt: new Date().toISOString(),
    },
    { action: "start-storefront", phase: "active" }
  )

  const shopEnv = {
    ...process.env,
    PORT: String(DEFAULT_PORTS.backendPort),
  }

  try {
    let procs = processes.get(slug)
    if (!procs?.backend) {
      procs = procs ?? {}
      processes.set(slug, procs)
    }

    const storefrontDir = join(shopPath, "storefront")
    const generatedStoreDir = storefrontGeneratedDir(shopPath)
    const fastStorefront =
      existsSync(join(generatedStoreDir, "package.json")) &&
      existsSync(join(generatedStoreDir, "node_modules"))

    const { syncAutoStorefrontEnv } = await import("./env")
    await syncAutoStorefrontEnv(shopPath, slug)
    await appendLocalRunLog(shopPath, "Synced storefront env from backend")

    let storefront: ChildProcess
    if (fastStorefront) {
      await appendLocalRunLog(
        shopPath,
        "Fast start: next dev in .generated-app (skipping rebuild & npm install)"
      )
      storefront = spawn("npm", ["run", "dev", "--", "-p", String(DEFAULT_PORTS.storefrontPort)], {
        cwd: generatedStoreDir,
        env: shopEnv,
        stdio: "pipe",
        detached: false,
      })
    } else {
      await ensureNpmInstall(shopPath, storefrontDir, "storefront compiler")
      await appendLocalRunLog(
        shopPath,
        "First-time setup: npm run dev:storefront (build & install — slower)"
      )
      storefront = spawn("npm", ["run", "dev:storefront"], {
        cwd: shopPath,
        env: shopEnv,
        stdio: "pipe",
        detached: false,
      })
    }
    procs.storefront = storefront
    attachProcessLogs(shopPath, storefront, "storefront")

    await appendLocalRunLog(
      shopPath,
      `Waiting for storefront at http://127.0.0.1:${DEFAULT_PORTS.storefrontPort}`
    )
    const storefrontOk = await waitForHealth(
      healthUrls(DEFAULT_PORTS.storefrontPort),
      fastStorefront ? 60 : 90,
      {
        projectId,
        onProgress: async (elapsedSec) => {
          const mins = Math.floor(elapsedSec / 60)
          const secs = elapsedSec % 60
          const elapsed = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
          await persistLocalRun(
            projectId,
            slug,
            {
              status: "starting",
              backendPort: DEFAULT_PORTS.backendPort,
              storefrontPort: DEFAULT_PORTS.storefrontPort,
              message: fastStorefront
                ? `Waiting for storefront… (${elapsed} elapsed)`
                : `First-time storefront setup in progress… (${elapsed} elapsed)`,
              startedAt: (await readLocalRunStatus(projectId)).startedAt,
            },
            { action: "start-storefront", phase: "active" }
          )
        },
      }
    )
    const state: LocalRunState = {
      status: storefrontOk ? "running" : "error",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message: storefrontOk ? "Backend and storefront running" : "Storefront failed to start within 3 minutes",
      startedAt: new Date().toISOString(),
    }
    await appendLocalRunLog(shopPath, state.message ?? state.status)
    await persistLocalRun(projectId, slug, state, {
      action: "start-storefront",
      phase: storefrontOk ? "completed" : "failed",
    })
    if (!storefrontOk) {
      if (procs.storefront && !procs.storefront.killed) {
        procs.storefront.kill("SIGTERM")
      }
      procs.storefront = undefined
    }
    return state
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLocalRunLog(shopPath, `FAILED: ${message}`)
    const state: LocalRunState = {
      status: "error",
      backendPort: DEFAULT_PORTS.backendPort,
      storefrontPort: DEFAULT_PORTS.storefrontPort,
      message,
    }
    await persistLocalRun(projectId, slug, state, { action: "start-storefront", phase: "failed" })
    return state
  }
}

export async function stopShopLocal(
  shopPath: string,
  slug: string,
  projectId: string
): Promise<LocalRunState> {
  await appendLocalRunLog(shopPath, "Stopping local servers…")
  const procs = processes.get(slug)
  for (const proc of [procs?.backend, procs?.storefront]) {
    if (proc && !proc.killed) {
      proc.kill("SIGTERM")
    }
  }
  processes.delete(slug)

  await killPort(DEFAULT_PORTS.storefrontPort)
  await killPort(DEFAULT_PORTS.backendPort)

  const state: LocalRunState = { status: "stopped", ...DEFAULT_PORTS, message: "Stopped" }
  await persistLocalRun(projectId, slug, state, { action: "stop", phase: "completed" })
  await appendLocalRunLog(shopPath, "Stopped")
  return state
}

async function probeHttp(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch {
    return false
  }
}

export async function probeLocalHealth(
  backendPort = DEFAULT_PORTS.backendPort,
  storefrontPort = DEFAULT_PORTS.storefrontPort
): Promise<LocalHealthProbe> {
  const hosts = ["127.0.0.1", "localhost"]
  let backend = false
  let storefront = false
  let backendUrl = `http://127.0.0.1:${backendPort}/health`
  let storefrontUrl = `http://127.0.0.1:${storefrontPort}`

  for (const host of hosts) {
    const healthUrl = `http://${host}:${backendPort}/health`
    if (!backend && (await probeHttp(healthUrl))) {
      backend = true
      backendUrl = healthUrl
    }
    const storeUrl = `http://${host}:${storefrontPort}`
    if (!storefront && (await probeHttp(storeUrl))) {
      storefront = true
      storefrontUrl = storeUrl
    }
  }

  return { backend, storefront, backendUrl, storefrontUrl }
}

function deriveStatusFromHealth(
  worker: LocalRunState,
  health: LocalHealthProbe
): Pick<LocalRunState, "status" | "message"> {
  if (health.backend && health.storefront) {
    return { status: "running", message: "Backend and storefront running" }
  }

  if (health.backend) {
    if (worker.status === "starting" && worker.message?.includes("storefront")) {
      return { status: "starting", message: worker.message }
    }
    if (worker.status === "stopped" || worker.status === "error") {
      return {
        status: "backend_running",
        message: "Backend detected on port (health check) — may have been started outside the wizard",
      }
    }
    return {
      status: "backend_running",
      message: worker.message?.includes("storefront")
        ? worker.message
        : "Backend running — start storefront from step 2 when ready",
    }
  }

  if (worker.status === "stopping") {
    return { status: "stopping", message: worker.message ?? "Stopping…" }
  }
  if (worker.status === "starting") {
    return { status: "starting", message: worker.message ?? "Starting…" }
  }
  if (worker.status === "error") {
    return { status: "error", message: worker.message ?? "Error" }
  }
  if (worker.status === "backend_running" || worker.status === "running") {
    return {
      status: worker.status,
      message:
        worker.message ??
        (health.backend
          ? undefined
          : "Worker reports running; health probe has not confirmed yet"),
    }
  }
  return { status: "stopped", message: "Not running" }
}

function deriveSnapshotStatus(
  worker: LocalRunState,
  health: LocalHealthProbe
): Pick<LocalRunState, "status" | "message"> & { detectedBy: "health" | "worker" } {
  if (worker.status === "stopping") {
    if (!health.backend && !health.storefront) {
      return { status: "stopped", message: "Stopped", detectedBy: "health" }
    }
    return { status: "stopping", message: worker.message ?? "Stopping…", detectedBy: "worker" }
  }

  if (worker.status === "starting") {
    if (health.backend && health.storefront) {
      return { status: "running", message: "Backend and storefront running", detectedBy: "health" }
    }
    if (health.backend) {
      return {
        status: "backend_running",
        message: worker.message?.includes("storefront")
          ? worker.message
          : "Backend is healthy — startup finishing or ready for storefront",
        detectedBy: "health",
      }
    }
    return { status: "starting", message: worker.message ?? "Starting…", detectedBy: "worker" }
  }

  const derived = deriveStatusFromHealth(worker, health)
  return {
    ...derived,
    detectedBy: health.backend || health.storefront ? "health" : "worker",
  }
}

function computeHoldInfo(params: {
  worker: LocalRunState
  record: Awaited<ReturnType<typeof getProjectLocalRun>>
  health: LocalHealthProbe
  hasInFlightJob: boolean
  queueJobState?: string | null
  workerOnline: boolean
}): LocalRunHoldInfo {
  const startedAt = params.worker.startedAt ? Date.parse(params.worker.startedAt) : 0
  const elapsedMs = startedAt ? Date.now() - startedAt : 0

  if (params.worker.status !== "starting" && params.worker.status !== "stopping") {
    return { stalled: false, elapsedMs }
  }

  if (params.worker.status === "starting" && params.health.backend) {
    return {
      stalled: false,
      elapsedMs,
      holdReason: "Backend is responding — syncing status…",
      suggestAction: "wait",
    }
  }

  if (params.queueJobState === "active") {
    return {
      stalled: false,
      elapsedMs,
      holdReason: "Worker is running your start job — check run logs for progress",
      suggestAction: "wait",
    }
  }

  if (params.queueJobState === "waiting" || params.queueJobState === "delayed") {
    return {
      stalled: elapsedMs > 120_000,
      elapsedMs,
      holdReason: params.workerOnline
        ? "Job is waiting in the worker queue — another job may be using all worker slots"
        : "Job is queued but worker is offline — run pnpm dev:worker",
      suggestAction: params.workerOnline ? "wait" : "check-worker",
    }
  }

  if (!params.workerOnline && (params.record?.phase === "queued" || elapsedMs > 20_000)) {
    return {
      stalled: elapsedMs > 30_000,
      elapsedMs,
      holdReason: "Background worker is offline — run pnpm dev:worker in a second terminal",
      suggestAction: "check-worker",
    }
  }

  if (params.record?.phase === "queued" && !params.hasInFlightJob && elapsedMs > 20_000) {
    return {
      stalled: true,
      elapsedMs,
      holdReason: "Queued but no worker job found — click Stop & retry or Run backend again",
      suggestAction: "retry",
    }
  }

  if (params.hasInFlightJob && elapsedMs >= 360_000) {
    return {
      stalled: true,
      elapsedMs,
      holdReason: "Start is taking unusually long — check run logs, then stop and retry",
      suggestAction: "retry",
    }
  }

  if (params.hasInFlightJob && elapsedMs >= 120_000) {
    return {
      stalled: false,
      elapsedMs,
      holdReason: "Still starting — npm install or first Medusa boot can take several minutes",
      suggestAction: "wait",
    }
  }

  if (!params.hasInFlightJob && elapsedMs >= 45_000) {
    return {
      stalled: true,
      elapsedMs,
      holdReason: "No active worker job — the start may have stalled",
      suggestAction: "retry",
    }
  }

  if (params.worker.status === "stopping" && elapsedMs > 15_000) {
    return {
      stalled: true,
      elapsedMs,
      holdReason: "Stop is taking longer than expected",
      suggestAction: "stop",
    }
  }

  return { stalled: false, elapsedMs, suggestAction: "wait" }
}

export async function getShopLocalSnapshot(
  shopPath: string,
  projectId: string,
  slug?: string
): Promise<LocalRunSnapshot> {
  const worker = await readLocalRunStatus(projectId)
  const record = await getProjectLocalRun(projectId)
  const ports = normalizePorts(worker)
  const health = await probeLocalHealth(ports.backendPort, ports.storefrontPort)
  const derived = deriveSnapshotStatus({ ...worker, ...ports }, health)

  const { getProjectLocalJobInFlight, getWorkerHealth } = await import("../queue/index")
  const inFlight = await getProjectLocalJobInFlight(projectId)
  const queueJobState = inFlight ? await inFlight.getState() : null
  const workerHealth = await getWorkerHealth()
  const hold = computeHoldInfo({
    worker,
    record,
    health,
    hasInFlightJob: Boolean(inFlight),
    queueJobState,
    workerOnline: workerHealth.online,
  })

  const snapshot: LocalRunSnapshot = {
    ...ports,
    status: derived.status ?? worker.status,
    message: derived.message ?? worker.message,
    startedAt: worker.startedAt,
    workerStatus: worker.status,
    savedStatus: worker.status,
    health,
    detectedBy: derived.detectedBy,
    hold,
  }

  const shouldPersist =
    slug &&
    derived.status !== worker.status &&
    (worker.status === "starting" ||
      worker.status === "stopping" ||
      worker.status === "stopped" ||
      worker.status === "error")

  if (shouldPersist) {
    await persistLocalRun(projectId, slug, {
      status: derived.status,
      backendPort: ports.backendPort,
      storefrontPort: ports.storefrontPort,
      message: derived.message,
      startedAt: worker.startedAt,
    }, {
      phase: derived.status === "stopped" || derived.status === "error" ? "failed" : "completed",
      action: record?.action,
    })
  }

  return snapshot
}

export async function getShopLocalStatus(
  shopPath: string,
  projectId: string,
  slug?: string
): Promise<LocalRunState> {
  const snapshot = await getShopLocalSnapshot(shopPath, projectId, slug)
  return {
    status: snapshot.status,
    backendPort: snapshot.backendPort,
    storefrontPort: snapshot.storefrontPort,
    message: snapshot.message,
    startedAt: snapshot.startedAt,
  }
}
