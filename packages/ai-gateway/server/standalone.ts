import path from "node:path"
import { serve } from "@hono/node-server"
import { createGatewayApp } from "./app.js"

const PORT = parseInt(process.env.GATEWAY_PORT || process.env.PORT || "3001", 10)
const HOST = process.env.GATEWAY_HOST || "0.0.0.0"
const DB_PATH =
  process.env.GATEWAY_DB_PATH || path.resolve(process.cwd(), "data", "ai-gateway.sqlite")

const { app } = createGatewayApp({ dbPath: DB_PATH })

console.log(`[AI Gateway] Starting standalone service on http://${HOST}:${PORT} ...`)
console.log(`[AI Gateway] SQLite database: ${DB_PATH}`)

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`[AI Gateway] Standalone service listening on http://${info.address}:${info.port}`)
    console.log(`  - Health Check:       http://localhost:${info.port}/health`)
    console.log(`  - OpenAI Endpoint:    http://localhost:${info.port}/v1/chat/completions`)
    console.log(`  - Claude Endpoint:    http://localhost:${info.port}/v1/messages`)
    console.log(`  - Gemini Endpoint:    http://localhost:${info.port}/v1beta/models/...`)
    console.log(`  - Models Endpoint:    http://localhost:${info.port}/v1/models`)
    console.log(`  - Management API:     http://localhost:${info.port}/v1/admin/*, /v1/tenant/*`)
  },
)
