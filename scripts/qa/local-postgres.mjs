#!/usr/bin/env node
// Disposable LOCAL Postgres for viewing-assessment QA. Only ever talks to one Docker container that this
// script creates, bound to 127.0.0.1, data on tmpfs (gone when the container stops). It never reads, prints
// or uses DATABASE_URL / Supabase settings; child processes get a scrubbed environment.
//
//   node scripts/qa/local-postgres.mjs check      read-only: tooling + isolation self-test (safe to run any time)
//   node scripts/qa/local-postgres.mjs up         create + start the container (pulls postgres:16-alpine once)
//   node scripts/qa/local-postgres.mjs migrate    apply saved_deals prerequisite + viewing migration (single txn each)
//   node scripts/qa/local-postgres.mjs migrate --all   apply every db/migrations/*.sql in filename order
//   node scripts/qa/local-postgres.mjs rollback   run the migration's documented DROP list (single txn)
//   node scripts/qa/local-postgres.mjs test       run the Postgres repository contract tests against the container
//   node scripts/qa/local-postgres.mjs reset      down + up + migrate (proves a clean re-apply)
//   node scripts/qa/local-postgres.mjs down       remove the container (refuses if it is not ours)
//   node scripts/qa/local-postgres.mjs status
//
// The generated password lives only in .qa-local/pg.env (gitignored) and is never printed.

import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createConnection } from "node:net"
import { FORBIDDEN_ENV, LOCAL_QA, assertLocalQaTarget, buildLocalQaUrl, findPortConflicts, scrubbedEnv } from "./local-qa-target.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const stateDir = path.join(root, ".qa-local")
const envFile = path.join(stateDir, "pg.env")
const migrationsDir = path.join(root, "db", "migrations")
// Applied in dependency order by `migrate`: Saved Deals and the tables its services read, then viewing, sessions, refurbishment plans.
const PREREQ = [
  "20260522_phase4a_saved_deals_table.sql",
  "20260522_phase4a_deal_offers_table.sql",
  "20260522_phase4a_deal_tasks_table.sql",
  "20260524_phase4b_investor_shield_tables.sql",
  "20260622_phase4e_deal_evidence_table.sql",
  "20260706_phase4g_evidence_command_deal_evidence_extension.sql",
  "20261020_task2_viewing_assessment_tables.sql",
  "20261021_task5a_operator_sessions.sql",
  "20261022_task6a_refurb_plan.sql",
  "20261023_task6b_measurements.sql",
  "20261024_task6b_financial_proposals.sql",
  "20261025_task7a_capture_provenance.sql",
]
// Reverse dependency order: proposals depend on plans; plans depend on measurement sets; both depend on viewing assessments.
const ROLLBACK_MIGRATIONS = [
  "20261024_task6b_financial_proposals.sql",
  "20261022_task6a_refurb_plan.sql",
  "20261023_task6b_measurements.sql",
  "20261020_task2_viewing_assessment_tables.sql",
  "20261021_task5a_operator_sessions.sql",
]

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: "utf8", env: scrubbedEnv(), cwd: root, ...opts })

const docker = (...args) => run("docker", args)
const say = (line = "") => process.stdout.write(`${line}\n`)
function die(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function containerState() {
  const r = docker("inspect", "--format", "{{.State.Status}}|{{index .Config.Labels \"brik.qa\"}}", LOCAL_QA.container)
  if (r.status !== 0) return { exists: false }
  const [state, label] = r.stdout.trim().split("|")
  return { exists: true, state, ours: label === "viewing-local" }
}

// Is the QA port already taken by something that is not our container? Returns a human-readable reason or null.
// Container names are non-secret; nothing about the other resource is touched, only reported.
async function portConflict() {
  const ps = docker("ps", "-a", "--format", "{{.Names}}|{{.Ports}}")
  if (ps.status === 0) {
    const others = findPortConflicts(ps.stdout.split(/\r?\n/).filter(Boolean))
    if (others.length) return `published by another container (${others.join(", ")}), which is not ours`
  }
  const c = containerState()
  if (!c.exists) {
    const listening = await new Promise((resolve) => {
      const socket = createConnection({ host: LOCAL_QA.host, port: LOCAL_QA.port })
      socket.setTimeout(500)
      socket.once("connect", () => (socket.destroy(), resolve(true)))
      socket.once("timeout", () => (socket.destroy(), resolve(false)))
      socket.once("error", () => resolve(false))
    })
    if (listening) return "something that is not our container is already listening on it"
  }
  return null
}

// Our container must be the sole owner of the port, bound to loopback only.
async function requireIsolatedBinding() {
  const conflict = await portConflict()
  if (conflict) die(`REFUSING: ${LOCAL_QA.host}:${LOCAL_QA.port} is ${conflict}. Stopping before any database action.`)
  const bound = docker("port", LOCAL_QA.container, "5432/tcp")
  const lines = bound.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (bound.status !== 0 || lines.length !== 1 || lines[0] !== `${LOCAL_QA.host}:${LOCAL_QA.port}`) {
    die("REFUSING: the QA container is not bound exclusively to 127.0.0.1:" + LOCAL_QA.port + ".")
  }
}

function readPassword() {
  if (!existsSync(envFile)) die("No QA credentials yet. Run: node scripts/qa/local-postgres.mjs up")
  const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="))
  if (!line) die(".qa-local/pg.env is missing POSTGRES_PASSWORD; delete .qa-local and run up again")
  return line.slice("POSTGRES_PASSWORD=".length)
}

function ensureEnvFile() {
  mkdirSync(stateDir, { recursive: true })
  if (existsSync(envFile)) return
  writeFileSync(
    envFile,
    `POSTGRES_USER=${LOCAL_QA.user}\nPOSTGRES_PASSWORD=${randomBytes(24).toString("hex")}\nPOSTGRES_DB=${LOCAL_QA.database}\n`,
    { mode: 0o600 }
  )
}

function requireRunning() {
  const c = containerState()
  if (!c.exists || !c.ours) die("QA container is not present. Run: node scripts/qa/local-postgres.mjs up")
  if (c.state !== "running") die(`QA container is ${c.state}. Run: node scripts/qa/local-postgres.mjs reset`)
}

function psql(sql, label) {
  const r = run("docker", ["exec", "-i", LOCAL_QA.container, "psql", "-U", LOCAL_QA.user, "-d", LOCAL_QA.database, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"], { input: sql })
  if (r.status !== 0) die(`FAILED: ${label}\n${(r.stderr || "").split("\n").slice(0, 8).join("\n")}`)
  say(`ok: ${label}`)
}

async function check() {
  const v = docker("--version")
  say(`docker client:   ${v.status === 0 ? v.stdout.trim() : "NOT AVAILABLE"}`)
  const info = docker("info", "--format", "{{.ServerVersion}}")
  say(`docker daemon:   ${info.status === 0 ? `reachable (server ${info.stdout.trim()})` : "NOT reachable (start Docker Desktop)"}`)
  const c = docker("--version").status === 0 ? containerState() : { exists: false }
  say(`QA container:    ${c.exists ? `${c.state}${c.ours ? "" : " (NOT OURS: label mismatch)"}` : "not created"}`)
  const conflict = docker("--version").status === 0 ? await portConflict() : null
  say(`QA port ${LOCAL_QA.port}:   ${conflict ? `BLOCKED, ${conflict}` : c.exists ? "held by our container" : "free"}`)
  say("")
  say("Target identity (the ONLY database this tooling and its tests will accept):")
  say(`  container ${LOCAL_QA.container}, image ${LOCAL_QA.image}`)
  say(`  ${LOCAL_QA.host}:${LOCAL_QA.port}  database ${LOCAL_QA.database}  user ${LOCAL_QA.user}  (tmpfs, ephemeral)`)
  say("")
  say("Environment (presence only, values never read into output):")
  for (const name of FORBIDDEN_ENV) say(`  ${name}: ${process.env[name] ? "set in this shell (will be stripped from children)" : "not set"}`)
  say("")
  say("Isolation self-test:")
  const sample = buildLocalQaUrl("x")
  const cases = [
    ["accepts the local QA URL", sample, true],
    ["rejects a Supabase pooler host", "postgres://postgres.abc:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres", false],
    ["rejects a remote host on the QA port", `postgres://${LOCAL_QA.user}:x@db.example.com:${LOCAL_QA.port}/${LOCAL_QA.database}`, false],
    ["rejects a query-param host override", `${sample}?host=db.example.com`, false],
    ["rejects another database name on loopback", `postgres://${LOCAL_QA.user}:x@127.0.0.1:${LOCAL_QA.port}/postgres`, false],
  ]
  let bad = 0
  for (const [name, url, shouldPass] of cases) {
    let passed = true
    try {
      assertLocalQaTarget(url, {})
    } catch {
      passed = false
    }
    const okay = passed === shouldPass
    if (!okay) bad++
    say(`  ${okay ? "PASS" : "FAIL"}  ${name}`)
  }
  if (bad) die("Isolation self-test failed.")
  if (conflict) die(`
BLOCKED: the approved QA address is not available. Nothing was started or changed.`)
}

const [command, ...flags] = process.argv.slice(2)

switch (command) {
  case "check":
    await check()
    break
  case "status": {
    const c = containerState()
    say(c.exists ? `container ${LOCAL_QA.container}: ${c.state}${c.ours ? "" : " (NOT OURS)"}` : "container: not created")
    break
  }
  case "up": {
    if (docker("--version").status !== 0) die("Docker is not available.")
    const existing = containerState()
    const taken = await portConflict()
    if (taken) die(`REFUSING: ${LOCAL_QA.host}:${LOCAL_QA.port} is ${taken}. Stopping before any database action; nothing was created.`)
    if (existing.exists) die(`Container ${LOCAL_QA.container} already exists (${existing.state}). Use: reset or down.`)
    ensureEnvFile()
    const started = docker("run", "-d", "--name", LOCAL_QA.container, "--label", LOCAL_QA.label, "--env-file", envFile,
      "-p", `${LOCAL_QA.host}:${LOCAL_QA.port}:5432`, "--tmpfs", "/var/lib/postgresql/data:rw,size=256m", LOCAL_QA.image)
    if (started.status !== 0) die(`docker run failed:\n${(started.stderr || "").split("\n").slice(0, 6).join("\n")}`)
    for (let i = 0; i < 60; i++) {
      if (docker("exec", LOCAL_QA.container, "pg_isready", "-U", LOCAL_QA.user, "-d", LOCAL_QA.database).status === 0) {
        say(`ready: ${LOCAL_QA.host}:${LOCAL_QA.port}/${LOCAL_QA.database} (user ${LOCAL_QA.user})`)
        process.exit(0)
      }
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"])
    }
    die("Postgres did not become ready in 60s.")
    break
  }
  case "migrate": {
    requireRunning()
    await requireIsolatedBinding()
    const files = flags.includes("--all") ? readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort() : PREREQ
    for (const f of files) psql(readFileSync(path.join(migrationsDir, f), "utf8"), `apply ${f}`)
    break
  }
  case "rollback": {
    requireRunning()
    await requireIsolatedBinding()
    const sql = ROLLBACK_MIGRATIONS.map((f) => readFileSync(path.join(migrationsDir, f), "utf8")).join("\n")
    const drops = sql.split(/\r?\n/).filter((l) => /^--\s{3}DROP (TABLE|FUNCTION) IF EXISTS brik_by_brik_engine\.\w+(\(\))?;$/.test(l)).map((l) => l.replace(/^--\s+/, ""))
    if (drops.length !== 15) die(`Expected 15 documented DROP statements, found ${drops.length}. Not running a partial rollback.`)
    psql(`${drops.join("\n")}\n`, "rollback viewing + session migrations")
    break
  }
  case "test": {
    requireRunning()
    await requireIsolatedBinding()
    const url = buildLocalQaUrl(readPassword())
    assertLocalQaTarget(url, {}) // same guard the tests apply; fail here with a clear message
    const testTargets = flags.length > 0 ? flags : ["__tests__/postgres/"]
    const r = spawnSync(process.execPath, [path.join(root, "node_modules", "vitest", "vitest.mjs"), "run", "--no-file-parallelism", ...testTargets], {
      cwd: root,
      stdio: "inherit",
      env: { ...scrubbedEnv(), VIEWING_QA_DATABASE_URL: url, VIEWING_QA_CONFIRM_ISOLATED: "I_CONFIRM_THIS_IS_NOT_PRODUCTION" },
    })
    process.exit(r.status ?? 1)
    break
  }
  case "down": {
    const c = containerState()
    if (!c.exists) say("container: not created")
    else if (!c.ours) die(`Container ${LOCAL_QA.container} lacks our label; refusing to remove it.`)
    else {
      docker("rm", "-f", LOCAL_QA.container)
      say("removed: container and its tmpfs data")
    }
    break
  }
  case "reset":
    for (const step of ["down", "up", "migrate"]) {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), step], { stdio: "inherit", env: scrubbedEnv() })
      if (r.status !== 0) process.exit(r.status ?? 1)
    }
    break
  default:
    die("Usage: node scripts/qa/local-postgres.mjs <check|up|migrate [--all]|rollback|test|reset|down|status>")
}
