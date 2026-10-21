import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { qaGate } from "./qa-gate"

// Real-PostgreSQL leg of the operator session store (isolated disposable QA database only; see qa-gate.ts).
// Writes only rows whose subject starts with "qa-session-", and deletes them afterwards.

const gate = qaGate("Postgres operator sessions")
const S = "brik_by_brik_engine"

describe.skipIf(!gate.enabled)("Postgres operator session store (isolated QA only)", () => {
  let db: typeof import("@/lib/db/postgres")
  let store: import("@/lib/auth/session").SessionStore
  let session: typeof import("@/lib/auth/session")
  const subject = `qa-session-${randomUUID()}`
  const T = new Date("2026-10-21T09:00:00.000Z")

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()
    store = (await import("@/lib/auth/pg-session-store")).pgSessionStore
    session = await import("@/lib/auth/session")
  })
  afterAll(async () => {
    await db?.query(`DELETE FROM ${S}.operator_sessions WHERE subject LIKE 'qa-session-%'`)
    await db?.getPostgresPool().end()
  })

  const request = (cookie: string) => new Request("https://app.example.test/x", { headers: { cookie } })

  it("round-trips a session and stores only the hash", async () => {
    const { id } = await session.startSession(store, subject, T)
    const raw = await db.query(`SELECT * FROM ${S}.operator_sessions WHERE session_hash = $1`, [session.hashSessionId(id)])
    expect(raw.rows).toHaveLength(1)
    expect(JSON.stringify(raw.rows[0])).not.toContain(id)
    const check = await session.checkSession(request(`__Host-brik_session=${id}`), store, new Date(T.getTime() + 1000))
    expect(check).toMatchObject({ status: "valid", subject })
  })

  it("enforces absolute and idle expiry and revocation against the real table", async () => {
    const { id } = await session.startSession(store, subject, T)
    const req = request(`__Host-brik_session=${id}`)
    expect((await session.checkSession(req, store, new Date(T.getTime() + session.SESSION_IDLE_MS))).status).toBe("invalid")
    expect((await session.checkSession(req, store, new Date(T.getTime() + 1000))).status).toBe("valid")
    await store.revoke(session.hashSessionId(id), new Date(T.getTime() + 2000))
    expect((await session.checkSession(req, store, new Date(T.getTime() + 3000))).status).toBe("invalid")
  })

  it("touch moves last_seen forward but never backward, and never revives a revoked session", async () => {
    const { id } = await session.startSession(store, subject, T)
    const hash = session.hashSessionId(id)
    await store.touch(hash, new Date(T.getTime() + 120_000))
    await store.touch(hash, new Date(T.getTime() + 60_000))
    expect((await store.find(hash))!.lastSeenAt.getTime()).toBe(T.getTime() + 120_000)
    await store.revoke(hash, new Date(T.getTime() + 130_000))
    await store.touch(hash, new Date(T.getTime() + 500_000))
    expect((await store.find(hash))!.lastSeenAt.getTime()).toBe(T.getTime() + 120_000)
  })

  it("the database refuses malformed rows (non-hash id, empty subject, expiry before creation)", async () => {
    const bad = (hash: string, subj: string, exp: Date) =>
      db.query(`INSERT INTO ${S}.operator_sessions (session_hash, subject, created_at, last_seen_at, expires_at) VALUES ($1,$2,$3,$3,$4)`, [hash, subj, T, exp])
    await expect(bad("not-a-hash", subject, new Date(T.getTime() + 1000))).rejects.toThrow()
    await expect(bad("a".repeat(64), "", new Date(T.getTime() + 1000))).rejects.toThrow()
    await expect(bad("b".repeat(64), subject, new Date(T.getTime() - 1000))).rejects.toThrow()
  })

  it("an unknown session id is simply absent", async () => {
    expect(await store.find("c".repeat(64))).toBeNull()
  })
})
