import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
    })
  }
  return transporter
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  const from = process.env.SMTP_FROM ?? "noreply@medusa-web-builder.local"
  await getTransporter().sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  })
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const url = `${baseUrl}/api/auth/verify-email?token=${token}`
  await sendEmail({
    to: email,
    subject: "Verify your email — Medusa Web Builder",
    html: `<p>Click to verify your email:</p><p><a href="${url}">${url}</a></p>`,
    text: `Verify your email: ${url}`,
  })
}

export async function sendInviteEmail(
  email: string,
  projectName: string,
  token: string,
  role: string
) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const url = `${baseUrl}/invites/${token}`
  await sendEmail({
    to: email,
    subject: `You're invited to ${projectName}`,
    html: `<p>You've been invited as <strong>${role}</strong> to <strong>${projectName}</strong>.</p><p><a href="${url}">Accept invitation</a></p>`,
    text: `Accept invitation: ${url}`,
  })
}
