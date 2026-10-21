import { query } from "@/lib/db/postgres"
import type { SessionRecord, SessionStore } from "./session"

type Row = { subject: string; created_at: Date; last_seen_at: Date; expires_at: Date; revoked_at: Date | null }

// All timestamps come from the application clock (passed in), never the database clock, so lifetimes are checked and
// stored on one timeline.
export const pgSessionStore: SessionStore = {
  async create({ idHash, subject, now, expiresAt }) {
    await query(
      "INSERT INTO brik_by_brik_engine.operator_sessions (session_hash, subject, created_at, last_seen_at, expires_at) VALUES ($1, $2, $3, $3, $4)",
      [idHash, subject, now, expiresAt]
    )
  },
  async find(idHash) {
    const { rows } = await query<Row>(
      "SELECT subject, created_at, last_seen_at, expires_at, revoked_at FROM brik_by_brik_engine.operator_sessions WHERE session_hash = $1",
      [idHash]
    )
    const r = rows[0]
    if (!r) return null
    const record: SessionRecord = { subject: r.subject, createdAt: r.created_at, lastSeenAt: r.last_seen_at, expiresAt: r.expires_at, revokedAt: r.revoked_at }
    return record
  },
  async touch(idHash, now) {
    await query("UPDATE brik_by_brik_engine.operator_sessions SET last_seen_at = $2 WHERE session_hash = $1 AND revoked_at IS NULL AND last_seen_at < $2", [idHash, now])
  },
  async revoke(idHash, now) {
    await query("UPDATE brik_by_brik_engine.operator_sessions SET revoked_at = $2 WHERE session_hash = $1 AND revoked_at IS NULL", [idHash, now])
  },
}
