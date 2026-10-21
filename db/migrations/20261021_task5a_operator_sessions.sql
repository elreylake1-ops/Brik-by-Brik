-- Option 2 / Task 5A: operator cookie sessions (PROPOSED - NOT APPLIED).
-- Scope: one new table in brik_by_brik_engine. No change to any existing table.
-- Apply ONLY to an isolated non-Production QA/Preview database, never to Production or a shared project whose
-- isolation from Production is unverified:
--   psql "$QA_URL" --single-transaction -v ON_ERROR_STOP=1 -f <this file>
-- Order: after 20261020_task2_viewing_assessment_tables.sql (independent of it, but both come after saved_deals).
--
-- Only the SHA-256 of the session id is stored, so reading this table does not yield usable cookies.
-- No token from the identity provider is stored. subject is the verified identity-provider subject.
-- Rows are never deleted by the application: sign-out sets revoked_at. Expired rows may be purged by an operator job.
--
-- Rollback (destroys active sessions only; everyone signs in again):
--   DROP TABLE IF EXISTS brik_by_brik_engine.operator_sessions;

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.operator_sessions (
  session_hash TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT ck_operator_sessions_hash CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_operator_sessions_subject CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT ck_operator_sessions_lifetime CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_subject
  ON brik_by_brik_engine.operator_sessions (subject, created_at DESC);
