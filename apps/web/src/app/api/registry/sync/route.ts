import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  return NextResponse.json(
    { error: "Registry sync from online repos has been removed. Use the admin panel to manage sections and plugins." },
    { status: 410 }
  )
}
