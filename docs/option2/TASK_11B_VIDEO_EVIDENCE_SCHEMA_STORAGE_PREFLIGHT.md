# Task 11B — Additive Video Evidence Database & Storage Preflight (with Task 11B-1 / 11B-2 Lineage Hardening)

**Document:** `docs/option2/TASK_11B_VIDEO_EVIDENCE_SCHEMA_STORAGE_PREFLIGHT.md`  
**Agent:** Ponytail v5.3.2  
**Branch:** `feat/task-11b-video-evidence-schema` (isolated worktree from `92d2066`)  
**Mode:** Isolated local development & testing only  
**Production Status:** STRICTLY PROHIBITED  
**Verdict:** `TASK 11B-2 COMPLETE — LOCAL VIDEO SCHEMA CHECKPOINT PRESERVED`

---

## 1. Executive Summary & Lineage Integrity Hardening

Task 11B establishes and validates the minimal additive database schema and private storage design required for James Lake's Video-to-Evidence pipeline.

All work was performed in an isolated local worktree (`.worktrees/task-11b-schema-preflight`) branched from the clean Option 2 commit (`92d2066`). Frozen release candidates (`92d2066` and `58e3193`) and existing database tables (`saved_deals`, `viewing_assessments`, `viewing_evidence`, `viewing_proposals`, `viewing_reviews`) were left completely untouched.

### Task 11B-1 & 11B-2 Corrections Summary:
1. **Retention Segregation & Original Evidence Safeguard (Task 11B-1):**
   - Separated 30-day temporary derivative retention (`temporary_retention_expires_at`) from original raw video evidence (`original_retention_policy`), which defaults to `RETAIN_PENDING_OWNER_POLICY`.
   - Prevented any automated cleanup or background purge from deleting original evidence until James Lake formally decides on the long-term archiving policy.
2. **Lineage Protection via Restricted Deletion (Task 11B-2):**
   - Replaced `ON DELETE CASCADE` with `ON DELETE RESTRICT` on:
     * `fk_video_jobs_deal` (referencing `saved_deals(id)`)
     * `fk_video_jobs_viewing` (referencing `viewing_assessments(deal_id, id)`)
     * `fk_video_frames_job` (referencing `video_jobs(id)`)
   - Deleting a parent Saved Deal or Viewing Assessment cannot silently destroy child video evidence or its cryptographic provenance. Deletion is restricted at the constraint layer, requiring explicit archival.
3. **Database-Level Immutability & Anti-Tampering Triggers (Task 11B-2):**
   - `trg_video_frames_protect_reviewed`: Rejects `DELETE` on any frame where `is_reviewed_evidence = TRUE`, rejects demotion from `TRUE` to `FALSE`, and rejects modification of cryptographic or lineage fields (`sha256`, `original_frame_path`, `thumbnail_path`, `source_time_ms`, `sequence_no`).
   - `trg_video_jobs_protect_retained`: Rejects `DELETE` on any video job while `original_retention_policy IN ('RETAIN_PENDING_OWNER_POLICY', 'OWNER_PERMANENT')` or when containing reviewed frames. Rejects policy switches to `OWNER_SCHEDULED_PURGE` unless explicit `retention_decision_notes` are provided.
   - `trg_video_jobs_no_truncate` and `trg_video_frames_no_truncate`: Reject `TRUNCATE` at the statement level, raising `% is append-only`.
4. **Safe Non-Destructive Hosted Recovery:**
   - Stripped all recommendations of hosted `DROP TABLE ... CASCADE`.
   - Recovery in hosted environments relies on pre-migration snapshots, route deprecation, and revoking write grants from `service_role`. Destructive teardown is restricted exclusively to disposable local QA containers.

---

## 2. Retention Classification & Governance Boundaries

| Category | Storage Target | Default Retention Rule | Automated Cleanup Behavior |
|---|---|---|---|
| **1. Temporary Worker Files** | Local worker tmpfs (`/tmp/brik-video-*`) | Immediate (job completion/failure) | Auto-deleted via `tempfile.TemporaryDirectory` exit handler. Zero persistence on disk. |
| **2. Abandoned Uploads** | `deal-evidence/video-evidence/.../original.*` (`state = 'upload_pending'`) | 24 hours | Upload intents not confirmed within 24 hours marked `failed` and unlinked objects pruned. |
| **3. Original Video Evidence** | `deal-evidence/video-evidence/{dealId}/{jobId}/original.*` | **RETAIN_PENDING_OWNER_POLICY** (Permanent until decided) | **IMMUTABLE & PROTECTED.** No automated cleanup script or schema default can delete original evidence. Protected by DB trigger against deletion. |
| **4. Extracted Frames & Reviewed Evidence** | `deal-evidence/video-evidence/{dealId}/{jobId}/extracted/frame_*.png` | Unreviewed: 30 days<br>Reviewed (`is_reviewed_evidence = TRUE`): Permanent | Frames linked to viewing checklist items become immutable viewing evidence. Unlinked candidate frames expire with temporary retention. |
| **5. Thumbnails & Contact Sheets** | `deal-evidence/video-evidence/{dealId}/{jobId}/thumbnails/`<br>`contact_sheet.jpg` | 30 days / Aligned with temporary retention | Non-authoritative UI derivatives. Can be regenerated from original evidence if retained. |

### Unresolved Owner Policy Decision
> **POLICY PENDING OWNER APPROVAL (James Lake):**  
> While temporary worker files and derivative caches are bounded by 30-day limits, long-term retention of original raw video files (which average 100–300 MB per clip) requires a commercial decision:
> 1. **Option A:** Retain raw original videos indefinitely in private cold storage (e.g. S3 Glacier / Supabase cold storage tier).
> 2. **Option B:** Purge raw original video after deal completion or fixed period (e.g. 90 days post-completion), retaining only the lossless extracted frames and reviewed evidence permanently.
> 3. **Current Safeguard:** Until James Lake makes this formal decision, the database schema enforces `original_retention_policy = 'RETAIN_PENDING_OWNER_POLICY'` and blocks all purging of original media.

---

## 3. Verified Additive Migration

**File:** [`db/migrations/20261026_task11b_video_evidence_schema.sql`](file:///c:/Users/HP%20ELITE%20BOOK/Documents/Brik-by-Brik/.worktrees/task-11b-schema-preflight/db/migrations/20261026_task11b_video_evidence_schema.sql)

```sql
-- Migration: Additive Video Evidence Schema (Task 11B / 11B-1 / 11B-2)
-- Scope: Additive tables for video evidence jobs and extracted frames.
-- Invariant: Zero modification to existing business, financial, or review tables.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

-- 1. video_jobs: Lifecycle tracking, intake metadata, and evidence retention
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
  
  -- Retention separation
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

-- 2. video_frames: Decoded lossless PNG frames, timestamps, and cryptographic hashes
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

-- 3. Security & Access Control
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

-- 4. Evidence Lineage & Immutability Protection Triggers
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
    IF OLD.state IN ('ready_for_review', 'processing') AND (
       NEW.source_path <> OLD.source_path OR
       (OLD.sha256 IS NOT NULL AND NEW.sha256 <> OLD.sha256) OR
       NEW.deal_id <> OLD.deal_id OR
       NEW.viewing_id <> OLD.viewing_id
    ) THEN
      RAISE EXCEPTION 'Cannot alter evidence attributes (deal_id, viewing_id, source_path, sha256) of video job %', OLD.id;
    END IF;

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

-- Guard against TRUNCATE
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
```

---

## 4. Local Test Results & Verification

All tests executed against the isolated local Docker PostgreSQL QA database (`brik-viewing-qa-pg` on port 54339):

### Dedicated Schema Tests ([`__tests__/postgres/video-evidence-schema.pg.test.ts`](file:///c:/Users/HP%20ELITE%20BOOK/Documents/Brik-by-Brik/.worktrees/task-11b-schema-preflight/__tests__/postgres/video-evidence-schema.pg.test.ts)):
1. `enforces Row Level Security (RLS) on both video tables` -> **PASSED**
2. `inserts a valid video job with server-generated path, temporary 30-day expiry, and protected original evidence policy` -> **PASSED**
3. `enforces valid original_retention_policy values and protects original evidence from unapproved purge` -> **PASSED**
4. `rejects cross-deal mismatch via composite foreign key (deal_id, viewing_id)` -> **PASSED**
5. `rejects invalid video_jobs constraints (invalid path, oversized bytes, invalid mime)` -> **PASSED**
6. `stores extracted video frames and enforces lineage, timestamp and sequence uniqueness` -> **PASSED**
7. `enforces evidence immutability on reviewed frames: rejects deletion, demotion, and tampering` -> **PASSED**
8. `protects original video job lineage: rejects deletion under RETAIN_PENDING_OWNER_POLICY and rejects un-audited purge policy switches` -> **PASSED**
9. `restricts deletion of parent deal or viewing assessment when video evidence exists (no silent cascade)` -> **PASSED**
10. `rejects TRUNCATE on video_jobs and video_frames to guard audit lineage` -> **PASSED**

### Overall Test Suite Outcome:
- **Postgres Contract Suite (`scripts/qa/local-postgres.mjs test`):**
  - **6 test files passed**, 1 skipped (remote auth mock)
  - **121 tests passed** (100% pass rate)
- **Phase 1 MVP Regression Suite (`__tests__/phase-1-mvp-regression.test.ts`):**
  - **14 tests passed** (0 failures)

---

## 5. Remaining Hosted-Only Checks

The following checks cannot be executed locally and remain pending isolated Preview deployment:
1. **Supabase Storage TUS Resumable Endpoint:** Real-world chunked TUS upload via `tus-js-client` against the hosted Supabase Storage endpoint.
2. **Mobile Network Resiliency:** In-field physical testing of upload recovery across cell/Wi-Fi drops on Android devices.
3. **Hosted Service-Role Policy Verification:** Verification of service-role bypass under Supabase hosted environment runtime.

---

## 6. Next Steps

Task 11B is complete. Local checkpoint commit created on branch `feat/task-11b-video-evidence-schema`.
Ready to proceed to **Task 11C (Additive API Routes & Token Generation)**.
