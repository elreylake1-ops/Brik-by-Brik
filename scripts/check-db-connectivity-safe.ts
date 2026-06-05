import fs from "node:fs"
import path from "node:path"
import dns from "node:dns/promises"
import { Pool } from "pg"

type SafeSummary = {
  databaseUrlPresent: boolean
  postgresUrlPresent: boolean
  supabaseDbUrlPresent: boolean
  repoVariableUsed: "DATABASE_URL"
  hostCategory: "pooler" | "direct" | "ipv6" | "localhost" | "unknown" | "malformed"
  sslModePresent: boolean
  passwordPresent: boolean
  dnsProfile: "dual_stack" | "ipv4_only" | "ipv6_only_or_ipv6_preferred" | "unresolved" | "malformed"
  parseOk: boolean
  connectivity: "ok" | "ENOTFOUND" | "ENETUNREACH" | "ECONNREFUSED" | "timeout" | "auth_failed" | "other"
}

function readEnvFileVars() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  const vars: Record<string, string> = {}

  if (!fs.existsSync(envPath)) {
    return vars
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n#]+)"?\s*$/)
    if (match) {
      vars[match[1]] = match[2].trim()
    }
  }

  return vars
}

function classifyHostCategory(value: string) {
  try {
    const url = new URL(value)
    if (/pooler/i.test(url.hostname)) {
      return { parseOk: true, hostCategory: "pooler" as const, hostname: url.hostname }
    }
    if (/^db\./i.test(url.hostname)) {
      return { parseOk: true, hostCategory: "direct" as const, hostname: url.hostname }
    }
    if (/localhost|127\.0\.0\.1/i.test(url.hostname)) {
      return { parseOk: true, hostCategory: "localhost" as const, hostname: url.hostname }
    }
    if (url.hostname.includes(":")) {
      return { parseOk: true, hostCategory: "ipv6" as const, hostname: url.hostname }
    }

    return { parseOk: true, hostCategory: "unknown" as const, hostname: url.hostname }
  } catch {
    return { parseOk: false, hostCategory: "malformed" as const, hostname: "" }
  }
}

async function classifyDnsProfile(hostname: string): Promise<SafeSummary["dnsProfile"]> {
  if (!hostname) {
    return "malformed"
  }

  let aCount = 0
  let aaaaCount = 0

  try {
    aCount = (await dns.resolve4(hostname)).length
  } catch {}

  try {
    aaaaCount = (await dns.resolve6(hostname)).length
  } catch {}

  if (aCount > 0 && aaaaCount > 0) {
    return "dual_stack"
  }
  if (aaaaCount > 0) {
    return "ipv6_only_or_ipv6_preferred"
  }
  if (aCount > 0) {
    return "ipv4_only"
  }

  return "unresolved"
}

function classifyConnectivityError(error: unknown): SafeSummary["connectivity"] {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : ""
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (code === "ENOTFOUND" || message.includes("enotfound")) {
    return "ENOTFOUND"
  }
  if (code === "ENETUNREACH" || message.includes("enetunreach")) {
    return "ENETUNREACH"
  }
  if (code === "ECONNREFUSED" || message.includes("econnrefused")) {
    return "ECONNREFUSED"
  }
  if (code === "ETIMEDOUT" || message.includes("timeout")) {
    return "timeout"
  }
  if (message.includes("password authentication failed") || message.includes("auth")) {
    return "auth_failed"
  }

  return "other"
}

async function main() {
  const envVars = readEnvFileVars()
  const databaseUrl = process.env.DATABASE_URL ?? envVars.DATABASE_URL ?? ""
  const { parseOk, hostCategory, hostname } = classifyHostCategory(databaseUrl)
  const summary: SafeSummary = {
    databaseUrlPresent: databaseUrl.length > 0,
    postgresUrlPresent: Boolean(process.env.POSTGRES_URL ?? envVars.POSTGRES_URL),
    supabaseDbUrlPresent: Boolean(process.env.SUPABASE_DB_URL ?? envVars.SUPABASE_DB_URL),
    repoVariableUsed: "DATABASE_URL",
    hostCategory,
    sslModePresent: /(sslmode|ssl)=/i.test(databaseUrl),
    passwordPresent: /:\/\/[^/]+:[^@]+@/.test(databaseUrl),
    dnsProfile: await classifyDnsProfile(hostname),
    parseOk,
    connectivity: "other",
  }

  if (!databaseUrl) {
    summary.connectivity = "other"
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = 1
    return
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  })

  try {
    await pool.query("select 1 as ok")
    summary.connectivity = "ok"
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    summary.connectivity = classifyConnectivityError(error)
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
