import http from "node:http"

const port = Number(process.env.PORT ?? 9090)

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/deploy") {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString("utf8")
    console.log(`[deploy-stub] ${new Date().toISOString()} ${body}`)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ releaseId: `local-${Date.now()}` }))
    return
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404).end()
})

server.listen(port, "0.0.0.0", () => {
  console.log(`Deploy stub listening on :${port} (POST /deploy, GET /health)`)
})
