import { describe, expect, it } from "vitest"

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

  it("refuses to claim success when rollback fails", async () => {
    await expect(tool.runRotationScenario({
      updateDatabase: async () => {},
      writeConfig: async () => { throw new Error("config write failed") },
      verifyNewPassword: async () => true,
      rollbackDatabase: async () => { throw new Error("rollback failed") },
    })).rejects.toThrow(/rollback failed/i)
  })
})
