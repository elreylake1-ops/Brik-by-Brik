import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { FORBIDDEN_ENV, LOCAL_QA, assertLocalQaTarget, buildLocalQaUrl, findPortConflicts, scrubbedEnv } from "../scripts/qa/local-qa-target.mjs"

const good = buildLocalQaUrl("p@ss/word?")
const root = path.resolve(__dirname, "..")

describe("local QA target guard (isolation from Supabase Production/Preview)", () => {
  it("accepts exactly the local disposable database, including an encoded password", () => {
    expect(assertLocalQaTarget(good, {})).toEqual({ host: "127.0.0.1", port: 54339, database: "brik_viewing_qa_local", user: "brik_qa" })
    expect(assertLocalQaTarget(good.replace("127.0.0.1", "localhost"), {}).host).toBe("localhost")
  })

  it.each([
    ["a Supabase pooler URL", "postgres://postgres.abcdef:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"],
    ["a Supabase direct URL", "postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres"],
    ["a remote host on the QA port", `postgres://brik_qa:x@10.0.0.5:54339/${LOCAL_QA.database}`],
    ["a hostname that merely starts with localhost", `postgres://brik_qa:x@localhost.evil.test:54339/${LOCAL_QA.database}`],
    ["the wrong port", `postgres://brik_qa:x@127.0.0.1:5432/${LOCAL_QA.database}`],
    ["the default port (no port)", `postgres://brik_qa:x@127.0.0.1/${LOCAL_QA.database}`],
    ["another database on loopback", "postgres://brik_qa:x@127.0.0.1:54339/postgres"],
    ["another user", `postgres://postgres:x@127.0.0.1:54339/${LOCAL_QA.database}`],
    ["a host override in the query string", `${good}?host=db.abcdef.supabase.co`],
    ["any query string", `${good}?sslmode=disable`],
    ["a fragment", `${good}#x`],
    ["a non-postgres scheme", good.replace("postgres:", "https:")],
    ["garbage", "not a url"],
    ["empty", ""],
  ])("rejects %s", (_label, url) => {
    expect(() => assertLocalQaTarget(url, {})).toThrow(/QA target rejected/)
  })

  it("rejects a URL equal to, or pointing at the same database as, any application database variable", () => {
    for (const name of FORBIDDEN_ENV) {
      expect(() => assertLocalQaTarget(good, { [name]: good })).toThrow(/application database/)
      expect(() => assertLocalQaTarget(good, { [name]: "postgres://other:y@127.0.0.1:54339/brik_viewing_qa_local" })).toThrow(/application database/)
    }
    expect(assertLocalQaTarget(good, { DATABASE_URL: "postgres://u:p@db.abc.supabase.co:5432/postgres" }).port).toBe(54339)
  })

  it("never echoes the URL or password in an error", () => {
    try {
      assertLocalQaTarget("postgres://u:topsecret@db.supabase.co:5432/postgres", {})
    } catch (error) {
      expect((error as Error).message).not.toMatch(/topsecret|supabase\.co|u:/)
    }
  })

  it("scrubs every application database variable from child environments", () => {
    const env = Object.fromEntries(FORBIDDEN_ENV.map((n) => [n, "x"]).concat([["PATH", "/bin"]]))
    expect(Object.keys(scrubbedEnv(env))).toEqual(["PATH"])
  })
})

describe("QA tooling is structurally confined to the local container", () => {
  const script = readFileSync(path.join(root, "scripts/qa/local-postgres.mjs"), "utf8")
  const guard = readFileSync(path.join(root, "scripts/qa/local-qa-target.mjs"), "utf8")

  it("binds the published port to loopback only, on ephemeral storage, with a label it checks before deleting", () => {
    expect(script).toContain('`${LOCAL_QA.host}:${LOCAL_QA.port}:5432`')
    expect(LOCAL_QA.host).toBe("127.0.0.1")
    expect(script).toContain("--tmpfs")
    expect(script).toMatch(/c\.ours/)
    expect(script).not.toMatch(/-p",?\s*"?5432|0\.0\.0\.0/)
  })

  it("never reads application database variables or hosted-service endpoints", () => {
    expect(script).not.toMatch(/process\.env\.(DATABASE_URL|POSTGRES_URL|SUPABASE_DB_URL)/)
    // The self-test deliberately contains one fake Supabase URL that the guard must REJECT; exclude that line only.
    const withoutNegativeSample = `${script}\n${guard}`.replace(/^.*rejects a Supabase pooler host.*$/m, "")
    expect(withoutNegativeSample).not.toMatch(/\.supabase\.(co|com)|pooler\.supabase|aws-0-/)
  })

  it("never prints the generated password or full URLs", () => {
    expect(script).not.toMatch(/say\([^)]*(readPassword|buildLocalQaUrl|POSTGRES_PASSWORD)/)
    expect(script).not.toMatch(/console\.log/)
  })

  it("the rollback it runs is the migration's own documented DROP list (9 tables + 1 function)", () => {
    const sql = readFileSync(path.join(root, "db/migrations/20261020_task2_viewing_assessment_tables.sql"), "utf8")
    const drops = sql.split(/\r?\n/).filter((l) => /^--\s{3}DROP (TABLE|FUNCTION) IF EXISTS brik_by_brik_engine\.\w+(\(\))?;$/.test(l))
    expect(drops).toHaveLength(10)
    expect(drops.filter((d) => d.includes("DROP TABLE"))).toHaveLength(9)
    expect(drops[drops.length - 1]).toContain("DROP FUNCTION")
  })
})

describe("port-collision preflight (the approved QA address must belong to our container alone)", () => {
  it("flags another container publishing the QA port, in the exact shape Docker prints it", () => {
    const lines = [
      "supabase_db_iSchool|0.0.0.0:54329->5432/tcp, [::]:54329->5432/tcp",
      "supabase_kong_iSchool|0.0.0.0:54331->8000/tcp, [::]:54331->8000/tcp",
      "n8n|0.0.0.0:5678->5678/tcp, [::]:5678->5678/tcp",
    ]
    // the real collision that moved the QA port off 54329
    expect(findPortConflicts(lines, 54329)).toEqual(["supabase_db_iSchool"])
    expect(findPortConflicts(lines)).toEqual([]) // nothing on the current QA port
  })

  it("does not flag our own container, unrelated ports, container-side ports or longer port numbers", () => {
    expect(
      findPortConflicts([
        `${LOCAL_QA.container}|127.0.0.1:54339->5432/tcp`,
        "other|0.0.0.0:154339->5432/tcp",
        "other2|0.0.0.0:5432->54339/tcp",
        "other3|5432/tcp",
        "stopped|",
      ])
    ).toEqual([])
  })

  it("flags a container bound to loopback or IPv6 only, and reports each offender once", () => {
    expect(findPortConflicts(["a|127.0.0.1:54339->5432/tcp", "b|[::1]:54339->5432/tcp"])).toEqual(["a", "b"])
  })

  it("is enforced before every database action in the tooling", () => {
    const script = readFileSync(path.join(root, "scripts/qa/local-postgres.mjs"), "utf8")
    for (const command of ["up", "migrate", "rollback", "test"]) {
      const block = script.slice(script.indexOf(`case "${command}"`), script.indexOf("case ", script.indexOf(`case "${command}"`) + 6))
      expect(block, command).toMatch(/portConflict\(\)|requireIsolatedBinding\(\)/)
    }
  })
})
