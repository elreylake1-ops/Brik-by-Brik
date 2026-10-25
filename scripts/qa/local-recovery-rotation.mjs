#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { LOCAL_QA, assertLocalQaTarget, scrubbedEnv } from "./local-qa-target.mjs"

export const COMMANDS = ["preflight", "backup", "verify-backup", "restore-test", "test-rotation"]
export const ROTATION_ENABLED = false

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const envFile = path.join(root, ".qa-local", "pg.env")
const backupRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "Brik-by-Brik", "qa-backups")
const protectedContainer = LOCAL_QA.container
const protectedLabel = "viewing-local"

export function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, "postgres://[REDACTED]@")
    .replace(/(password|secret|token|pgpassword)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
}

export function validateDatabaseUrl(url) {
  return assertLocalQaTarget(url, {})
}

export function generateReplacementPassword() {
  return randomBytes(32).toString("hex")
}

export function assertDisposableContainer(name, port) {
  if (!/^brik-qa-recovery-[a-z0-9-]+$/.test(name) || name === protectedContainer) {
    throw new Error("temporary container name is not owned by the recovery tool")
  }
  if (!Number.isInteger(port) || port < 55000 || port > 55999) {
    throw new Error("temporary recovery port is outside the reserved local range")
  }
}

function approvedArchive(file) {
  const resolved = path.resolve(file)
  const base = path.resolve(backupRoot) + path.sep
  if (!resolved.startsWith(base) || path.basename(resolved) !== "brik-viewing-qa-local.dump") {
    fail("backup archive path is outside the protected backup directory")
  }
  if (!existsSync(resolved)) return resolved
  const actual = realpathSync(resolved)
  if (!actual.startsWith(base)) fail("backup archive resolves outside the protected backup directory")
  return actual
}

function fail(message) {
  throw new Error(redact(message))
}

function docker(args, options = {}) {
  return spawnSync("docker", args, { ...options, encoding: "utf8", env: scrubbedEnv(), cwd: root })
}

function readPassword() {
  if (!existsSync(envFile)) fail(".qa-local/pg.env is missing")
  const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("POSTGRES_PASSWORD="))
  if (!line) fail("POSTGRES_PASSWORD is missing from .qa-local/pg.env")
  return line.slice("POSTGRES_PASSWORD=".length)
}

function ensureTarget() {
  const inspected = docker(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{index .Config.Labels \"brik.qa\"}}", protectedContainer])
  if (inspected.status !== 0) fail("protected QA container is unavailable")
  const [name, state, label] = inspected.stdout.trim().replace(/^\//, "").split("|")
  if (name !== protectedContainer || label !== protectedLabel || state !== "running") fail("protected QA container identity/state rejected")
  const binding = docker(["port", protectedContainer, "5432/tcp"])
  if (binding.status !== 0 || binding.stdout.trim() !== `${LOCAL_QA.host}:${LOCAL_QA.port}`) fail("QA container is not bound exclusively to the approved loopback endpoint")
  return { name, state, label, endpoint: `${LOCAL_QA.host}:${LOCAL_QA.port}`, database: LOCAL_QA.database }
}

function withPgPass(password, fn) {
  const dir = fsTempDir()
  const passFile = path.join(dir, "pgpass")
  writeFileSync(passFile, `${LOCAL_QA.host}:${LOCAL_QA.port}:${LOCAL_QA.database}:${LOCAL_QA.user}:${password}\n`, { mode: 0o600 })
  chmodSync(passFile, 0o600)
  try {
    return fn({ ...scrubbedEnv(), PGPASSFILE: passFile })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function withToolEnv(password, fn) {
  const dir = fsTempDir()
  const file = path.join(dir, "tool.env")
  writeFileSync(file, `PGPASSWORD=${password}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
  try { return fn(file) } finally { rmSync(dir, { recursive: true, force: true }) }
}

function fsTempDir() {
  const dir = path.join(os.tmpdir(), `brik-qa-recovery-${process.pid}-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

function hasWindowsTool(name) {
  try { execFileSync("where.exe", [name], { stdio: "ignore" }); return true } catch { return false }
}

function dumpArchive(archive, password) {
  const args = ["--host", LOCAL_QA.host, "--port", String(LOCAL_QA.port), "--username", LOCAL_QA.user, "--dbname", LOCAL_QA.database, "--format", "custom", "--file", "-"]
  if (hasWindowsTool("pg_dump")) {
    return withPgPass(password, (env) => {
      const result = spawnSync("pg_dump", args, { encoding: null, env, cwd: root, windowsHide: true })
      if (result.status !== 0) fail("pg_dump failed")
      writeFileSync(archive, result.stdout, { mode: 0o600 })
    })
  }
  return withToolEnv(password, (envFile) => {
    const name = `brik-qa-recovery-tools-${process.pid}`
    if (docker(["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]).stdout.trim()) fail("recovery tools container name is already occupied")
    try {
      const created = docker(["create", "--name", name, "--add-host", "host.docker.internal:host-gateway", "--env-file", envFile, "postgres:16-alpine", "pg_dump", "--host", "host.docker.internal", "--port", String(LOCAL_QA.port), "--username", LOCAL_QA.user, "--dbname", LOCAL_QA.database, "--format", "custom", "--file", "/tmp/backup.dump"])
      if (created.status !== 0) fail("could not create disposable PostgreSQL 16 tools container")
      const started = docker(["start", "-a", name])
      if (started.status !== 0) fail("disposable PostgreSQL 16 pg_dump failed")
      const copied = docker(["cp", `${name}:/tmp/backup.dump`, archive])
      if (copied.status !== 0) fail("could not copy the binary backup from the tools container")
      chmodSync(archive, 0o600)
    } finally {
      docker(["rm", "-f", name])
    }
  })
}

function restoreList(archive) {
  if (hasWindowsTool("pg_restore")) {
    return spawnSync("pg_restore", ["--list", archive], { encoding: "utf8", env: scrubbedEnv(), cwd: root, windowsHide: true })
  }
  return spawnSync("docker", ["run", "--rm", "-v", `${archive}:/work/archive:ro`, "postgres:16-alpine", "pg_restore", "--list", "/work/archive"], { encoding: "utf8", env: scrubbedEnv(), cwd: root, windowsHide: true })
}

function checksum(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

function archiveMeta(file) {
  const digest = checksum(file)
  const size = statSync(file).size
  return { file: path.basename(file), size, sha256: digest }
}

export async function runRotationScenario({ updateDatabase, writeConfig, verifyNewPassword, rollbackDatabase }) {
  try {
    await updateDatabase()
    try {
      await writeConfig()
      if (!(await verifyNewPassword())) throw new Error("new password validation failed")
      return { status: "validated" }
    } catch (error) {
      await rollbackDatabase()
      throw error
    }
  } catch (error) {
    if (/rollback failed/i.test(String(error?.message))) throw error
    throw new Error(`rotation not validated: ${redact(error?.message || error)}`)
  }
}

function preflight() {
  const target = ensureTarget()
  const size = docker(["exec", protectedContainer, "psql", "-U", LOCAL_QA.user, "-d", LOCAL_QA.database, "-Atc", "select pg_database_size(current_database())"])
  const capacity = statfs(backupRoot)
  console.log(JSON.stringify({ target, databaseBytes: Number(size.stdout.trim()), backupRoot, availableBytes: capacity }))
}

function statfs(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  try {
    const output = execFileSync("node", ["-e", "const s=require('node:fs').statfsSync(process.argv[1]); console.log(String(s.bavail*s.bsize))", directory], { encoding: "utf8" })
    return Number(output.trim())
  } catch {
    return null
  }
}

function backup() {
  ensureTarget()
  const password = readPassword()
  const dir = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, "-"))
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const archive = path.join(dir, "brik-viewing-qa-local.dump")
  try {
    dumpArchive(archive, password)
    const meta = archiveMeta(archive)
    writeFileSync(`${archive}.sha256`, `${meta.sha256}  ${meta.file}\n`, { mode: 0o600 })
    verifyArchive(archive)
    console.log(JSON.stringify(meta))
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}

function verifyArchive(archive = process.argv[3]) {
  archive = approvedArchive(archive)
  if (!existsSync(archive)) fail("backup archive is missing")
  const digestFile = `${archive}.sha256`
  if (existsSync(digestFile)) {
    const expected = readFileSync(digestFile, "utf8").split(/\s+/)[0]
    if (expected !== checksum(archive)) fail("backup checksum mismatch")
  }
  const listing = restoreList(archive)
  if (listing.status !== 0 || !listing.stdout.includes("brik_by_brik_engine")) {
    fail(`backup archive readability check failed: ${(listing.stderr || "missing schema entry").split(/\r?\n/).slice(0, 2).join(" ")}`)
  }
  console.log(JSON.stringify({ archive: path.basename(archive), ...archiveMeta(archive), readable: true }))
}

function restoreTest() {
  const name = process.argv[3] || `brik-qa-recovery-${process.pid}`
  const port = Number(process.argv[4] || 55000 + (process.pid % 999))
  assertDisposableContainer(name, port)
  const collision = docker(["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"])
  if (collision.stdout.trim()) fail("temporary recovery container name is already occupied")
  console.log(JSON.stringify({ status: "planned", container: name, port, activeContainerUntouched: true }))
}

function testRotation() {
  if (ROTATION_ENABLED) fail("real rotation must remain disabled")
  console.log(JSON.stringify({ status: "mock-only", realRotation: "disabled" }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command] = process.argv.slice(2)
  try {
    if (command === "preflight") preflight()
    else if (command === "backup") backup()
    else if (command === "verify-backup") verifyArchive()
    else if (command === "restore-test") restoreTest()
    else if (command === "test-rotation") testRotation()
    else fail(`usage: node scripts/qa/local-recovery-rotation.mjs ${COMMANDS.join("|")}`)
  } catch (error) {
    console.error(redact(error.message || error))
    process.exitCode = 1
  }
}
