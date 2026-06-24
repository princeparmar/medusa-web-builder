import { NextResponse } from "next/server"
import { getWorkerHealth } from "@mwb/core/queue"

export async function GET() {
  const health = await getWorkerHealth()
  return NextResponse.json(health)
}
