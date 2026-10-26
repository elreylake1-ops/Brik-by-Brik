import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")
const readSpec = (name: string) => readFileSync(path.join(root, "e2e", name), "utf8")

describe("E2E harness isolation contract", () => {
  const specs = ["local-video-upload-acceptance.spec.ts", "november-6-rehearsal.spec.ts", "operator-smoke.spec.ts", "operator-workflow.spec.ts", "task-11e-video-evidence.spec.ts"]

  it("does not mutate worker-global QA environment", () => {
    for (const spec of specs) expect(readSpec(spec)).not.toMatch(/process\.env\.(DATABASE_URL|VIEWING_QA_CONFIRM_ISOLATED)\s*=/)
  })

  it("keeps temporary fixture cleanup failures visible", () => {
    const upload = readSpec("local-video-upload-acceptance.spec.ts")
    expect(upload).not.toContain(".catch(() => undefined)")
    expect(upload).toContain("requires isolated QA baseline recovery")

    const task11e = readSpec("task-11e-video-evidence.spec.ts")
    expect(task11e).not.toContain(".catch(() => undefined)")
    expect(task11e).toContain("Task 11E fixture cleanup requires isolated QA baseline recovery")
  })

  it("uses baseline recovery instead of deleting append-only upload records", () => {
    const source = readSpec("local-video-upload-acceptance.spec.ts")
    expect(source).not.toMatch(/DELETE\s+FROM\s+[^`]*viewing_proposals/i)
    expect(source).not.toMatch(/DELETE\s+FROM\s+[^`]*video_frames/i)
    expect(source).toContain("post-test isolated QA baseline recovery")
  })
})
