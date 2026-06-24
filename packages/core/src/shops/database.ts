import { exec } from "child_process"
import { promisify } from "util"
import { shopDatabaseName, shopInfraEnv } from "./infra"

const execAsync = promisify(exec)

export async function ensureShopDatabase(slug: string): Promise<void> {
  const infra = shopInfraEnv()
  const dbName = shopDatabaseName(slug)
  const check = `SELECT 1 FROM pg_database WHERE datname='${dbName}'`
  const env = { ...process.env, PGPASSWORD: infra.pgPass }

  try {
    const { stdout } = await execAsync(
      `psql -h ${infra.pgHost} -p ${infra.pgPort} -U ${infra.pgUser} -d postgres -tAc "${check}"`,
      { env, timeout: 15_000 }
    )
    if (stdout.trim() === "1") return
    await execAsync(
      `psql -h ${infra.pgHost} -p ${infra.pgPort} -U ${infra.pgUser} -d postgres -c "CREATE DATABASE \\"${dbName}\\""`,
      { env, timeout: 15_000 }
    )
  } catch (err) {
    console.warn(`[shops] Could not ensure database ${dbName}:`, err)
  }
}
