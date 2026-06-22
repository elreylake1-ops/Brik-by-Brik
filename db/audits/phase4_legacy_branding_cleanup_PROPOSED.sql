-- PROPOSED ONLY
-- DO NOT RUN WITHOUT REVIEW
-- REQUIRES JAMES SUPABASE OWNERSHIP CONFIRMATION
-- REQUIRES BACKUP AND ROW-COUNT REVIEW

BEGIN;

-- Pre-update inspection: populate from the read-only audit results before making any change.
CREATE TEMP TABLE phase4_legacy_branding_cleanup_candidates (
  table_name text NOT NULL,
  column_name text NOT NULL,
  record_id text NOT NULL,
  matched_value text NOT NULL
) ON COMMIT DROP;

-- Example read-only intake step.
-- In a reviewed run, insert the approved rows from the audit output here.
-- INSERT INTO phase4_legacy_branding_cleanup_candidates (...)
-- SELECT ... FROM phase4_legacy_branding_matches;

SELECT
  table_name,
  column_name,
  record_id,
  matched_value
FROM phase4_legacy_branding_cleanup_candidates
ORDER BY table_name, column_name, record_id;

-- Narrow update template:
-- Only apply updates after a human review confirms the column contains application branding,
-- not a real property/address/deal note.
--
-- UPDATE brik_by_brik_engine.some_metadata_table
-- SET some_branding_column = replace(some_branding_column, 'Lake Views Property', 'Brik by Brik Engine')
-- WHERE id::text IN (
--   SELECT record_id
--   FROM phase4_legacy_branding_cleanup_candidates
--   WHERE table_name = 'brik_by_brik_engine.some_metadata_table'
--     AND column_name = 'some_branding_column'
-- )
--   AND lower(some_branding_column) LIKE '%lake views%';

-- Post-update verification template:
-- SELECT table_name, column_name, record_id, matched_value
-- FROM phase4_legacy_branding_cleanup_candidates
-- ORDER BY table_name, column_name, record_id;

-- Rollback guidance:
-- If any review step fails, do not commit this transaction.
-- Re-run the read-only audit and regenerate the candidate set.

ROLLBACK;
