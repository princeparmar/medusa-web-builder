import { spawn } from "child_process"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { readShopEnv } from "./env"

export type ShopAdminCredentials = {
  email: string
  password: string
  adminUrl: string
}

export function getDefaultShopAdminCredentials(slug: string): ShopAdminCredentials {
  const email = `admin@${slug}.local`
  const password = `${slug.charAt(0).toUpperCase()}${slug.slice(1)}@123`
  return { email, password, adminUrl: "http://localhost:9000/app" }
}

async function readAdminCredentialsFromMakefile(shopPath: string): Promise<ShopAdminCredentials | null> {
  const makefilePath = join(shopPath, "Makefile")
  if (!existsSync(makefilePath)) return null

  const content = await readFile(makefilePath, "utf8")
  const emailMatch = content.match(/^ADMIN_EMAIL \?= (.+)$/m)
  const passwordMatch = content.match(/^ADMIN_PASSWORD \?= (.+)$/m)
  if (!emailMatch?.[1] || !passwordMatch?.[1]) return null

  return {
    email: emailMatch[1].trim(),
    password: passwordMatch[1].trim(),
    adminUrl: "http://localhost:9000/app",
  }
}

export async function getShopAdminCredentials(
  shopPath: string,
  slug: string
): Promise<ShopAdminCredentials> {
  const fromMakefile = await readAdminCredentialsFromMakefile(shopPath)
  return fromMakefile ?? getDefaultShopAdminCredentials(slug)
}

function medusaBackendCwd(shopPath: string): string {
  const generated = join(shopPath, "backend", ".generated-backend")
  if (existsSync(generated)) return generated
  return join(shopPath, "backend")
}

function runMedusaUser(
  cwd: string,
  env: Record<string, string>,
  email: string,
  password: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["medusa", "user", "-e", email, "-p", password], {
      cwd,
      env: { ...process.env, ...env },
      stdio: "pipe",
    })

    let output = ""
    const append = (chunk: Buffer | string) => {
      output += String(chunk)
    }
    proc.stdout?.on("data", append)
    proc.stderr?.on("data", append)

    proc.on("error", reject)
    proc.on("close", (code) => {
      const text = output.trim()
      if (code === 0) {
        resolve(text)
        return
      }
      if (/already exists|duplicate/i.test(text)) {
        resolve(text)
        return
      }
      reject(new Error(text || `medusa user failed (exit ${code ?? "?"})`))
    })
  })
}

export async function createShopMedusaAdmin(
  shopPath: string,
  slug: string
): Promise<{ credentials: ShopAdminCredentials; output: string }> {
  const credentials = await getShopAdminCredentials(shopPath, slug)
  const cwd = medusaBackendCwd(shopPath)

  if (!existsSync(cwd)) {
    throw new Error("Backend not scaffolded — run the backend first")
  }

  const env = await readShopEnv(shopPath)
  const output = await runMedusaUser(cwd, env, credentials.email, credentials.password)
  return { credentials, output }
}
