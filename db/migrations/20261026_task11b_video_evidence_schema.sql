-- Migration: Additive Video Evidence Schema (Task 11B / 11B-1 / 11B-2)
-- Scope: Additive tables for video evidence jobs and extracted frames.
-- Invariant: Zero modification to existing business, financial, or review tables.
-- Non-Destructive Recovery Note: In hosted/preview environments, DO NOT use DROP TABLE CASCADE.
-- If rollback or remediation is needed, deprecate API route access and revoke write privileges:
--   REVOKE INSERT, UPDATE, DELETE ON brik_by_brik_engine.video_jobs FROM service_role;
--   REVOKE INSERT, UPDATE, DELETE ON brik_by_brik_engine.video_frames FROM service_role;
-- Destructive DROP TABLE ... CASCADE is strictly restricted to disposable local QA environments.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

-- ---------------------------------------------------------------------------------------------------------
-- 1. video_jobs: Lifecycle tracking, intake metadata, and evidence retention
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.video_jobs (
  id TEXT PRIMARY KEY DEFAULT ('vj_' || gen_random_uuid()::text),
  deal_id TEXT NOT NULL,
  viewing_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  source_bucket TEXT NOT NULL DEFAULT 'deal-evidence' CHECK (source_bucket = 'deal-evidence'),
  source_path TEXT NOT NULL UNIQUE CHECK (source_path ~ '^video-evidence/[A-Za-z0-9:_.-]+/[A-Za-z0-9:_.-]+/original\.(mp4|mov|m4v)$'),
  content_type TEXT NOT NULL CHECK (content_type IN ('video/mp4', 'video/quicktime', 'video/x-m4v')),
  declared_bytes BIGINT NOT NULL CHECK (declared_bytes > 0 AND declared_bytes <= 524288000),
  observed_bytes BIGINT CHECK (observed_bytes IS NULL OR (observed_bytes > 0 AND observed_bytes <= 524288000)),
  sha256 TEXT CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR (duration_ms BETWEEN 1 AND 300000)),
  contact_sheet_path TEXT,
  state TEXT NOT NULL DEFAULT 'upload_pending'
    CHECK (state IN ('upload_pending', 'queued', 'processing', 'ready_for_review', 'failed')),
  worker_id TEXT,
  lease_until TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_code TEXT,
  processor_version TEXT,
  -- Retention separation: temporary derivatives carry 30-day expiry; original evidence is preserved pending owner policy
  temporary_retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  original_retention_policy TEXT NOT NULL DEFAULT 'RETAIN_PENDING_OWNER_POLICY'
    CHECK (original_retention_policy IN ('RETAIN_PENDING_OWNER_POLICY', 'OWNER_PERMANENT', 'OWNER_SCHEDULED_PURGE')),
  retention_decision_notes TEXT,
  deletion_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (deletion_status IN ('ACTIVE', 'PENDING_DELETION', 'DELETED', 'RETAINED_PERMANENT')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lineage integrity: ON DELETE RESTRICT prevents silent cascade deletion of deals or assessments with video evidence
  CONSTRAINT fk_video_jobs_deal
    FOREIGN KEY (deal_id) REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE RESTRICT,
  CONSTRAINT fk_video_jobs_viewing
    FOREIGN KEY (deal_id, viewing_id) REFERENCES brik_by_brik_engine.viewing_assessments(deal_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_video_jobs_deal_viewing_id UNIQUE (deal_id, viewing_id, id)
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_deal_viewing
  ON brik_by_brik_engine.video_jobs (deal_id, viewing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_jobs_queue
  ON brik_by_brik_engine.video_jobs (state, lease_until, created_at);

CREATE INDEX IF NOT EXISTS idx_video_jobs_temporary_retention
  ON brik_by_brik_engine.video_jobs (temporary_retention_expires_at)
  WHERE deletion_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_video_jobs_original_policy
  ON brik_by_brik_engine.video_jobs (original_retention_policy);

-- ---------------------------------------------------------------------------------------------------------
-- 2. video_frames: Decoded lossless PNG frames, presentation timestamps, and cryptographic hashes
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.video_frames (
  id TEXT PRIMARY KEY DEFAULT ('vf_' || gen_random_uuid()::text),
  job_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 0 AND sequence_no < 40),
  source_time_ms INTEGER NOT NULL CHECK (source_time_ms >= 0 AND source_time_ms <= 300000),
  original_frame_path TEXT NOT NULL UNIQUE CHECK (original_frame_path ~ '^video-evidence/[A-Za-z0-9:_.-]+/[A-Za-z0-9:_.-]+/extracted/frame_[0-9]{3}\.png$'),
  thumbnail_path TEXT NOT NULL CHECK (thumbnail_path ~ '^video-evidence/[A-Za-z0-9:_.-]+/[A-Za-z0-9:_.-]+/thumbnails/frame_[0-9]{3}\.jpg$'),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type TEXT NOT NULL DEFAULT 'image/png' CHECK (mime_type IN ('image/png', 'image/jpeg')),
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 1920),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 1920),
  is_reviewed_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lineage integrity: ON DELETE RESTRICT prevents silent deletion of video job while frames exist
  CONSTRAINT fk_video_frames_job
    FOREIGN KEY (job_id) REFERENCES brik_by_brik_engine.video_jobs(id) ON DELETE RESTRICT,
  UNIQUE (job_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_video_frames_job_seq
  ON brik_by_brik_engine.video_frames (job_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_video_frames_reviewed
  ON brik_by_brik_engine.video_frames (job_id)
  WHERE is_reviewed_evidence = TRUE;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Security & Access Control Hardening
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE brik_by_brik_engine.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brik_by_brik_engine.video_frames ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON brik_by_brik_engine.video_jobs FROM anon;
    REVOKE ALL ON brik_by_brik_engine.video_frames FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON brik_by_brik_engine.video_jobs FROM authenticated;
    REVOKE ALL ON brik_by_brik_engine.video_frames FROM authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Evidence Lineage & Immutability Protection Triggers (Task 11B-2)
-- ---------------------------------------------------------------------------------------------------------

-- Enforce immutability and prevent deletion/tampering of reviewed evidence frames
CREATE OR REPLACE FUNCTION brik_by_brik_engine.video_frames_protect_reviewed_evidence()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_reviewed_evidence = TRUE THEN
      RAISE EXCEPTION 'Cannot delete video frame %: locked as reviewed evidence', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_reviewed_evidence = TRUE THEN
      IF NEW.is_reviewed_evidence = FALSE THEN
        RAISE EXCEPTION 'Cannot demote reviewed evidence for frame % (evidence is immutable)', OLD.id;
      END IF;
      IF NEW.original_frame_path <> OLD.original_frame_path OR
         NEW.thumbnail_path <> OLD.thumbnail_path OR
         NEW.sha256 <> OLD.sha256 OR
         NEW.source_time_ms <> OLD.source_time_ms OR
         NEW.sequence_no <> OLD.sequence_no OR
         NEW.job_id <> OLD.job_id THEN
        RAISE EXCEPTION 'Cannot modify evidence attributes of reviewed frame % (evidence is immutable)', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_frames_protect_reviewed ON brik_by_brik_engine.video_frames;
CREATE TRIGGER trg_video_frames_protect_reviewed
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.video_frames
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.video_frames_protect_reviewed_evidence();

-- Enforce preservation of original video jobs under retention policies
CREATE OR REPLACE FUNCTION brik_by_brik_engine.video_jobs_protect_retained_evidence()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.original_retention_policy IN ('RETAIN_PENDING_OWNER_POLICY', 'OWNER_PERMANENT') THEN
      RAISE EXCEPTION 'Cannot delete video job %: original video evidence is protected under % policy. Explicit owner authorization required.', OLD.id, OLD.original_retention_policy;
    END IF;
    IF EXISTS (SELECT 1 FROM brik_by_brik_engine.video_frames WHERE job_id = OLD.id AND is_reviewed_evidence = TRUE) THEN
      RAISE EXCEPTION 'Cannot delete video job %: contains reviewed evidence frames that are permanently retained.', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Protect core evidence fields once processing has started or completed
    IF OLD.state IN ('ready_for_review', 'processing') AND (
       NEW.source_path <> OLD.source_path OR
       (OLD.sha256 IS NOT NULL AND NEW.sha256 <> OLD.sha256) OR
       NEW.deal_id <> OLD.deal_id OR
       NEW.viewing_id <> OLD.viewing_id
    ) THEN
      RAISE EXCEPTION 'Cannot alter evidence attributes (deal_id, viewing_id, source_path, sha256) of video job %', OLD.id;
    END IF;

    -- Require audit trail notes to switch from retained policy to purge
    IF OLD.original_retention_policy IN ('RETAIN_PENDING_OWNER_POLICY', 'OWNER_PERMANENT')
       AND NEW.original_retention_policy = 'OWNER_SCHEDULED_PURGE'
       AND (NEW.retention_decision_notes IS NULL OR length(trim(NEW.retention_decision_notes)) < 5) THEN
      RAISE EXCEPTION 'Cannot schedule purge for video job % without explicit retention_decision_notes audit trail', OLD.id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_jobs_protect_retained ON brik_by_brik_engine.video_jobs;
CREATE TRIGGER trg_video_jobs_protect_retained
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.video_jobs
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.video_jobs_protect_retained_evidence();

-- Guard against TRUNCATE on audit & evidence tables
CREATE OR REPLACE FUNCTION brik_by_brik_engine.video_reject_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_jobs_no_truncate ON brik_by_brik_engine.video_jobs;
CREATE TRIGGER trg_video_jobs_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.video_jobs
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.video_reject_truncate();

DROP TRIGGER IF EXISTS trg_video_frames_no_truncate ON brik_by_brik_engine.video_frames;
CREATE TRIGGER trg_video_frames_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.video_frames
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.video_reject_truncate();
