import { spawn } from "child_process"
import { join } from "path"
import { mkdir, writeFile, readFile, appendFile } from "fs/promises"
import { existsSync } from "fs"

export type SeedRunState = {
  status: "idle" | "running" | "completed" | "error"
  message?: string
  startedAt?: string
  finishedAt?: string
}

type SeedStep = {
  cwd: string
  command: string
  args: string[]
  label: string
}

function seedLogPath(shopPath: string) {
  return join(shopPath, ".mwb", "seed.log")
}

function seedStatePath(shopPath: string) {
  return join(shopPath, ".mwb", "seed-run.json")
}

function backendGeneratedDir(shopPath: string) {
  return join(shopPath, "backend", ".generated-backend")
}

async function ensureMwbDir(shopPath: string) {
  await mkdir(join(shopPath, ".mwb"), { recursive: true })
}

export async function appendSeedLog(shopPath: string, line: string) {
  await ensureMwbDir(shopPath)
  const ts = new Date().toISOString()
  const text = line.endsWith("\n") ? line : `${line}\n`
  await appendFile(seedLogPath(shopPath), `[${ts}] ${text}`)
}

export async function clearSeedLogs(shopPath: string) {
  await ensureMwbDir(shopPath)
  await writeFile(seedLogPath(shopPath), "")
}

export async function readSeedLogs(shopPath: string, maxLines = 400): Promise<string[]> {
  const path = seedLogPath(shopPath)
  if (!existsSync(path)) return []
  const content = await readFile(path, "utf8")
  const lines = content.split("\n").filter(Boolean)
  return lines.slice(-maxLines)
}

export async function readSeedRunState(shopPath: string): Promise<SeedRunState> {
  const path = seedStatePath(shopPath)
  if (!existsSync(path)) return { status: "idle" }
  try {
    return JSON.parse(await readFile(path, "utf8")) as SeedRunState
  } catch {
    return { status: "idle" }
  }
}

async function writeSeedRunState(shopPath: string, state: SeedRunState) {
  await ensureMwbDir(shopPath)
  await writeFile(seedStatePath(shopPath), JSON.stringify(state, null, 2) + "\n")
}

function canFastSeed(shopPath: string): boolean {
  const generatedDir = backendGeneratedDir(shopPath)
  return (
    existsSync(join(generatedDir, "package.json")) &&
    existsSync(join(generatedDir, "node_modules"))
  )
}

function resolveSeedSteps(shopPath: string): { steps: SeedStep[]; fast: boolean } {
  const generatedDir = backendGeneratedDir(shopPath)
  const syncScript = join(shopPath, "scripts", "sync-publishable-key.mjs")

  if (canFastSeed(shopPath)) {
    const steps: SeedStep[] = [
      { cwd: generatedDir, command: "npm", args: ["run", "seed"], label: "medusa seed" },
    ]
    if (existsSync(syncScript)) {
      steps.push({
        cwd: shopPath,
        command: "node",
        args: ["scripts/sync-publishable-key.mjs", "--from-db"],
        label: "sync publishable key",
      })
    }
    return { steps, fast: true }
  }

  return {
    steps: [{ cwd: shopPath, command: "npm", args: ["run", "seed"], label: "npm run seed" }],
    fast: false,
  }
}

function runLoggedCommand(
  shopPath: string,
  step: SeedStep,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(step.command, step.args, {
      cwd: step.cwd,
      env: process.env,
      stdio: "pipe",
    })

    const capture: string[] = []
    const write = (chunk: Buffer | string, stream: string) => {
      const text = String(chunk)
      capture.push(text)
      for (const line of text.split("\n")) {
        if (line.trim()) void appendSeedLog(shopPath, `[${stream}] ${line}`)
      }
    }

    proc.stdout?.on("data", (c) => write(c, "stdout"))
    proc.stderr?.on("data", (c) => write(c, "stderr"))

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM")
      reject(new Error(`Seed step "${step.label}" timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    proc.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    proc.on("close", (code) => {
      clearTimeout(timeout)
      const output = capture.join("").trim()
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(`Seed step "${step.label}" exited with code ${code ?? "?"}`))
      }
    })
  })
}

/** Run shop root seed (Medusa seed + publishable key sync). Streams output to .mwb/seed.log */
export async function runShopSeed(shopPath: string): Promise<string> {
  await clearSeedLogs(shopPath)
  const startedAt = new Date().toISOString()
  const { steps, fast } = resolveSeedSteps(shopPath)

  await writeSeedRunState(shopPath, {
    status: "running",
    message: fast ? "Running medusa seed…" : "Running npm run seed…",
    startedAt,
  })

  if (fast) {
    await appendSeedLog(
      shopPath,
      "Fast seed: medusa exec in .generated-backend (skipping backend rebuild)"
    )
  } else {
    await appendSeedLog(shopPath, "Starting seed (npm run seed)…")
  }

  const outputs: string[] = []
  const timeoutMs = 300_000

  try {
    for (const step of steps) {
      await appendSeedLog(shopPath, `Running ${step.label}…`)
      outputs.push(await runLoggedCommand(shopPath, step, timeoutMs))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await appendSeedLog(shopPath, message)
    await writeSeedRunState(shopPath, {
      status: "error",
      message,
      startedAt,
      finishedAt: new Date().toISOString(),
    })
    throw err
  }

  const finishedAt = new Date().toISOString()
  await appendSeedLog(shopPath, "Seed finished successfully")
  await writeSeedRunState(shopPath, {
    status: "completed",
    message: "Seed complete",
    startedAt,
    finishedAt,
  })

  return outputs.join("\n").trim()
}
