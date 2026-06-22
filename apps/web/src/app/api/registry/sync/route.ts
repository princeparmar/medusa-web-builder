import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { enqueueRegistryJob } from "@mwb/core/queue"

export async function POST() {
  const { error } = await requireAuth()
  if (error) return error

  await enqueueRegistryJob({ type: "sections" })
  await enqueueRegistryJob({ type: "plugins" })
  await enqueueRegistryJob({ type: "refresh-versions" })

  return NextResponse.json({ status: "queued" }, { status: 202 })
}
