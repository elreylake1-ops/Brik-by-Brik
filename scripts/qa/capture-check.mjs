#!/usr/bin/env node
// Runs ONLY the client-side capture check (/viewing-capture-check) so a real video can be tried on a real phone without
// exposing the application.
//
//   node scripts/qa/capture-check.mjs            loopback only (127.0.0.1). Reach it from an Android phone over USB with
//                                                `adb reverse` (see docs/option2/ANDROID_CAPTURE_TEST.md). Nothing is on the network.
//   node scripts/qa/capture-check.mjs --lan      also listens on this computer's private Wi-Fi address (never 0.0.0.0).
//   node scripts/qa/capture-check.mjs --build    force a rebuild. Normal launch rebuilds only when commit or source inputs changed.
//
// How it stays safe:
//  - The real application is started on 127.0.0.1 (internal port) with every database/API-key variable blanked, so even if
//    something reached it there would be nothing to read or write.
//  - Only a small front door (capture-check-gate.mjs) is ever reachable from outside the process: it allows GET/HEAD of the
//    capture page and its static files and refuses everything else (all /api routes, all other pages), and refuses
//    unexpected Host headers.
//  - The page itself makes no API calls, stores nothing and uploads nothing.
// Stop it with Ctrl+C. It never opens a public tunnel and never binds to 0.0.0.0.

import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import http from "node:http"
import { networkInterfaces } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { decide, isPrivateIPv4 } from "./capture-check-gate.mjs"
import { FORBIDDEN_ENV } from "./local-qa-target.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const FRONT_PORT = 3400
const INTERNAL_PORT = 3401
const args = new Set(process.argv.slice(2))
const say = (line = "") => process.stdout.write(`${line}\n`)
const buildIdPath = path.join(root, ".next", "BUILD_ID")
const CAPTURE_CHECK_COMMIT = path.join(root, ".next", "CAPTURE_CHECK_COMMIT")

const gitResult = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" })
const currentRef = gitResult.status === 0 ? gitResult.stdout.trim() : "unknown"

const latestCaptureSourceMtime = (target) => {
  if (!existsSync(target)) return 0
  const stat = statSync(target)
  if (!stat.isDirectory()) return stat.mtimeMs
  return Math.max(stat.mtimeMs, ...readdirSync(target, { withFileTypes: true }).map((entry) => latestCaptureSourceMtime(path.join(target, entry.name))))
}

const canListen = (port) => new Promise((resolve) => {
  const probe = http.createServer()
  probe.once("error", () => resolve(false))
  probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)))
})

const ensurePortsAvailable = async () => {
  const busy = []
  for (const port of [FRONT_PORT, INTERNAL_PORT]) if (!(await canListen(port))) busy.push(port)
  if (busy.length) {
    say(`Capture check is already running or ports are busy: ${busy.join(", ")}. Stop the existing process before starting another.`)
    process.exit(1)
  }
}

await ensurePortsAvailable()

// ---- environment: blank everything that could point at a database or a paid service
const blanked = Object.fromEntries([...FORBIDDEN_ENV, "ANTHROPIC_API_KEY", "VIEWING_AI_ENABLED", "VIEWING_AI_PROVIDER", "OPERATOR_AUTH_MODE"].map((k) => [k, ""]))
const appEnv = { ...process.env, ...blanked, NODE_ENV: "production", VIEWING_CAPTURE_CHECK_PAGE: "true", VIEWING_CAPTURE_BUILD_REF: currentRef, NEXT_TELEMETRY_DISABLED: "1", PORT: String(INTERNAL_PORT) }

// ---- address to expose on (optional)
let lanAddress = null
if (args.has("--lan")) {
  const candidates = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal && isPrivateIPv4(i.address))
  if (candidates.length === 0) {
    say("No private (10.x / 172.16-31.x / 192.168.x) network address found. Not exposing on the network.")
    process.exit(1)
  }
  lanAddress = candidates[0].address
}

// ---- build if needed
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const captureInputs = ["app", "components", "lib", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json"].map((entry) => path.join(root, entry))
const newestSourceMtime = Math.max(...captureInputs.map(latestCaptureSourceMtime))
const builtRef = existsSync(CAPTURE_CHECK_COMMIT) ? readFileSync(CAPTURE_CHECK_COMMIT, "utf8").trim() : ""
const buildMtime = existsSync(buildIdPath) ? statSync(buildIdPath).mtimeMs : 0
const needsBuild = args.has("--build") || !buildMtime || builtRef !== currentRef || newestSourceMtime > buildMtime
if (needsBuild) {
  say("Building the application (one-off, about a minute)...")
  const built = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit", env: appEnv })
  if (built.status !== 0) {
    say("Build failed. Nothing was started.")
    process.exit(1)
  }
  writeFileSync(CAPTURE_CHECK_COMMIT, `${currentRef}\n`, { encoding: "utf8", mode: 0o600 })
} else {
  say(`Using current capture-check build for ${currentRef}.`)
}

// ---- the application, loopback only
const app = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(INTERNAL_PORT)], { cwd: root, env: appEnv, stdio: ["ignore", "ignore", "inherit"] })
app.on("exit", (code) => {
  say(`Application stopped (${code ?? "signal"}).`)
  process.exit(code ?? 0)
})

// ---- the front door
const allowedHosts = [`localhost:${FRONT_PORT}`, `127.0.0.1:${FRONT_PORT}`, ...(lanAddress ? [`${lanAddress}:${FRONT_PORT}`] : [])]
const front = http.createServer((req, res) => {
  const verdict = decide({ method: req.method, url: req.url, host: req.headers.host }, { allowedHosts })
  if (!verdict.allow) {
    res.writeHead(verdict.status, { "content-type": "text/plain", "cache-control": "no-store" })
    res.end(verdict.status === 404 ? "Not found" : verdict.reason)
    return
  }
  const upstream = http.request(
    { host: "127.0.0.1", port: INTERNAL_PORT, path: verdict.forwardPath, method: req.method, headers: { host: `127.0.0.1:${INTERNAL_PORT}`, accept: req.headers.accept ?? "*/*" } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, { ...up.headers, "cache-control": "no-store", "x-content-type-options": "nosniff" })
      up.pipe(res)
    }
  )
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain" })
    res.end("The capture check is still starting; reload in a few seconds.")
  })
  upstream.end()
})
front.on("upgrade", (_req, socket) => socket.destroy()) // no websockets are needed

const listenOn = (host) => new Promise((resolve) => front.listen(FRONT_PORT, host, resolve))
await listenOn(lanAddress ?? "127.0.0.1")

say("")
say("Capture check is running. Nothing is uploaded or saved by this page.")
say(`  Build:              ${currentRef}`)
say(`  On this computer:   http://localhost:${FRONT_PORT}/viewing-capture-check`)
if (lanAddress) {
  say(`  On your Wi-Fi:      http://${lanAddress}:${FRONT_PORT}/viewing-capture-check   (private network only; plain http)`)
  say("  Anyone on this Wi-Fi can open that one page. Do not use this on a shared or public network.")
} else {
  say(`  From an Android phone over USB:  adb reverse tcp:${FRONT_PORT} tcp:${FRONT_PORT}`)
  say(`                                   then open http://localhost:${FRONT_PORT}/viewing-capture-check on the phone`)
}
say("Press Ctrl+C to stop.")

const stop = () => {
  front.close()
  app.kill()
  setTimeout(() => process.exit(0), 500)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
