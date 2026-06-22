import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@mwb/db"
import { sendVerificationEmail } from "@mwb/core/email"
import { logAudit } from "@mwb/core/audit"
import { z } from "zod"

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    name: z.string().min(1).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const passwordHash = await hash(data.password, 12)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
      },
    })

    const token = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.verificationToken.create({
      data: { identifier: data.email, token, expires },
    })

    await sendVerificationEmail(data.email, token)
    await logAudit({ userId: user.id, action: "user.register", metadata: { email: data.email } })

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.errors[0]?.message ?? "Invalid input"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
