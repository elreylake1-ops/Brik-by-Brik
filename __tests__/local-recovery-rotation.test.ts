import { describe, expect, it } from "vitest"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

const tool = await import("../scripts/qa/local-recovery-rotation.mjs")

describe("local recovery and rotation safety", () => {
  it("accepts only the exact local QA target", () => {
    expect(tool.validateDatabaseUrl("postgres://brik_qa:ignored@127.0.0.1:54339/brik_viewing_qa_local")).toEqual({
      host: "127.0.0.1",
      port: 54339,
      database: "brik_viewing_qa_local",
      user: "brik_qa",
    })
    expect(() => tool.validateDatabaseUrl("postgres://brik_qa:x@db.example.com:54339/brik_viewing_qa_local")).toThrow()
  })

  it("redacts credentials and connection strings from messages", () => {
    const message = tool.redact("password=secret postgres://brik_qa:secret@127.0.0.1:54339/brik_viewing_qa_local")
    expect(message).not.toContain("secret")
    expect(message).toContain("[REDACTED]")
  })

  it("generates replacement passwords with sufficient entropy", () => {
    const password = tool.generateReplacementPassword()
    expect(password).toMatch(/^[0-9a-f]{64}$/)
  })

  it("does not expose real rotation as a CLI command", () => {
    expect(tool.COMMANDS).toEqual(["preflight", "backup", "verify-backup", "restore-test", "test-rotation"])
    expect(tool.ROTATION_ENABLED).toBe(false)
  })

  it("loads successfully through the real Node.js ESM runtime", () => {
    const result = spawnSync(process.execPath, ["scripts/qa/local-recovery-rotation.mjs", "test-rotation"], {
      cwd: process.cwd(), encoding: "utf8",
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('"realRotation":"disabled"')
    expect(result.stderr).not.toContain("SyntaxError")
  })

  it("refuses to claim success when rollback fails", async () => {
    await expect(tool.runRotationScenario({
      updateDatabase: async () => {},
      writeConfig: async () => { throw new Error("config write failed") },
      verifyNewPassword: async () => true,
      rollbackDatabase: async () => { throw new Error("rollback failed") },
    })).rejects.toThrow(/rollback failed/i)
  })

  it("replaces a disposable file atomically and preserves recovery contents", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "brik-qa-config-test-"))
    try {
      const target = path.join(dir, "config.env")
      const recovery = path.join(dir, "config.env.recovery")
      writeFileSync(target, "OLD_MOCK_SECRET\n")
      const result = tool.replaceConfigAtomically(target, recovery, "NEW_MOCK_SECRET\n")
      expect(result).toEqual({ target, recovery })
      expect(readFileSync(target, "utf8")).toBe("NEW_MOCK_SECRET\n")
      expect(readFileSync(recovery, "utf8")).toBe("OLD_MOCK_SECRET\n")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("preserves the target when replacement fails", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "brik-qa-config-failure-"))
    try {
      const target = path.join(dir, "config.env")
      const recovery = path.join(dir, "config.env.recovery")
      writeFileSync(target, "ORIGINAL_MOCK_SECRET\n")
      expect(() => tool.replaceConfigAtomically(target, recovery, "REPLACEMENT_MOCK_SECRET\n", {
        rename: () => { throw new Error("simulated replacement failure") },
      })).toThrow(/replacement failure/)
      expect(readFileSync(target, "utf8")).toBe("ORIGINAL_MOCK_SECRET\n")
      expect(readFileSync(recovery, "utf8")).toBe("ORIGINAL_MOCK_SECRET\n")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("rejects recovery collisions, permission failures, and flush failures safely", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "brik-qa-config-injection-"))
    try {
      const target = path.join(dir, "config.env")
      const recovery = path.join(dir, "config.env.recovery")
      writeFileSync(target, "ORIGINAL_MOCK_SECRET\n")
      writeFileSync(recovery, "RECOVERY_MOCK_SECRET\n")
      expect(() => tool.replaceConfigAtomically(target, recovery, "NEW_MOCK_SECRET\n")).toThrow(/already exists/)
      rmSync(recovery)
      expect(() => tool.replaceConfigAtomically(target, recovery, "NEW_MOCK_SECRET\n", {
        rename: () => { throw Object.assign(new Error("access denied"), { code: "EACCES" }) },
      })).toThrow(/access denied/)
      expect(readFileSync(target, "utf8")).toBe("ORIGINAL_MOCK_SECRET\n")
      rmSync(recovery)
      expect(() => tool.replaceConfigAtomically(target, recovery, "NEW_MOCK_SECRET\n", {
        flush: () => { throw Object.assign(new Error("flush denied"), { code: "EPERM" }) },
      })).toThrow(/flush denied/)
      expect(readFileSync(target, "utf8")).toBe("ORIGINAL_MOCK_SECRET\n")
      expect(existsSync(recovery)).toBe(true)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("connects the orchestration writer to the atomic replacement primitive", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "brik-qa-config-orchestration-"))
    try {
      const target = path.join(dir, "config.env")
      const recovery = path.join(dir, "config.env.recovery")
      writeFileSync(target, "OLD_MOCK_SECRET\n")
      const result = await tool.runRotationScenario({
        updateDatabase: async () => {},
        writeConfig: async () => tool.replaceConfigAtomically(target, recovery, "NEW_MOCK_SECRET\n"),
        verifyNewPassword: async () => true,
        rollbackDatabase: async () => {},
      })
      expect(result).toEqual({ status: "validated" })
      expect(readFileSync(target, "utf8")).toBe("NEW_MOCK_SECRET\n")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
