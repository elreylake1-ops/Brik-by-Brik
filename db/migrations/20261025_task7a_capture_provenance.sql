-- Option 2 / Task 7A: retain browser frame-capture provenance.
-- PROPOSED - NOT APPLIED to Production, Preview or any shared database.
-- Apply only to the verified disposable local QA database.
-- Existing evidence remains valid; provenance is nullable because older rows predate capture telemetry.
--
-- Rollback (only before shared use):
--   ALTER TABLE brik_by_brik_engine.viewing_evidence
--     DROP COLUMN IF EXISTS capture_confidence,
--     DROP COLUMN IF EXISTS capture_method,
--     DROP COLUMN IF EXISTS requested_timestamp_seconds;

ALTER TABLE brik_by_brik_engine.viewing_evidence
  ADD COLUMN IF NOT EXISTS requested_timestamp_seconds NUMERIC NULL
    CHECK (requested_timestamp_seconds IS NULL OR requested_timestamp_seconds >= 0),
  ADD COLUMN IF NOT EXISTS capture_method TEXT NULL
    CHECK (capture_method IS NULL OR capture_method IN ('video-frame-callback', 'seeked-canvas', 'manual')),
  ADD COLUMN IF NOT EXISTS capture_confidence TEXT NULL
    CHECK (capture_confidence IS NULL OR capture_confidence IN ('presented-frame-confirmed', 'seek-timestamp-verified', 'manual-user-positioned'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_viewing_evidence_capture_provenance_complete') THEN
    ALTER TABLE brik_by_brik_engine.viewing_evidence
      ADD CONSTRAINT ck_viewing_evidence_capture_provenance_complete CHECK (
        (requested_timestamp_seconds IS NULL AND capture_method IS NULL AND capture_confidence IS NULL)
        OR
        (requested_timestamp_seconds IS NOT NULL AND capture_method IS NOT NULL AND capture_confidence IS NOT NULL AND (
          (capture_method = 'video-frame-callback' AND capture_confidence = 'presented-frame-confirmed')
          OR (capture_method = 'seeked-canvas' AND capture_confidence = 'seek-timestamp-verified')
          OR (capture_method = 'manual' AND capture_confidence = 'manual-user-positioned')
        ))
      );
  END IF;
END
$$;
