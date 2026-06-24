import { AdminOperationsClient } from "./AdminOperationsClient"

export default function AdminOperationsPage() {
  return (
    <main className="container" style={{ padding: "2rem 1.5rem 3rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: "0.35rem" }}>Operations</h1>
        <p className="setup-muted">
          Live worker jobs, local server health, and which project each process belongs to.
        </p>
      </header>
      <AdminOperationsClient />
    </main>
  )
}
