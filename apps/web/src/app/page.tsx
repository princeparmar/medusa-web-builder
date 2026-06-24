import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <main className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Medusa Web Builder</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem", maxWidth: 560, margin: "0 auto 2rem" }}>
        Drag-and-drop storefront builder powered by Medusa. Scaffold shops into your monorepo,
        configure plugins and sections, and publish via GitHub.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <Link href="/register" className="btn btn-primary">
          Get started
        </Link>
        <Link href="/login" className="btn btn-secondary">
          Sign in
        </Link>
      </div>
    </main>
  )
}
