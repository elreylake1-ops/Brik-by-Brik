-- Phase 4 legacy branding audit
-- Read-only inspection only.
-- Do not run against production without review.

BEGIN;

CREATE TEMP TABLE phase4_legacy_branding_matches (
  table_name text NOT NULL,
  column_name text NOT NULL,
  record_id text NOT NULL,
  matched_value text NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  target_table text;
  target_column text;
  sql text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'brik_by_brik_engine.saved_deals',
    'brik_by_brik_engine.deal_offers',
    'brik_by_brik_engine.deal_tasks',
    'brik_by_brik_engine.investor_shield_checks',
    'brik_by_brik_engine.evidence_items',
    'brik_by_brik_engine.risk_flags',
    'brik_by_brik_engine.manual_overrides',
    'brik_by_brik_engine.builder_proposals',
    'brik_by_brik_engine.builder_contract_checks'
  ]
  LOOP
    FOR target_column IN
      SELECT c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = split_part(target_table, '.', 1)
        AND c.table_name = split_part(target_table, '.', 2)
        AND c.data_type IN ('text', 'character varying', 'character')
    LOOP
      sql := format($fmt$
        INSERT INTO phase4_legacy_branding_matches (
          table_name,
          column_name,
          record_id,
          matched_value
        )
        SELECT
          %L,
          %L,
          COALESCE(id::text, '<no id>'),
          left(COALESCE(%I::text, ''), 240)
        FROM %s
        WHERE lower(COALESCE(%I::text, '')) LIKE ANY (ARRAY[
          '%%lake views%%',
          '%%lakeviews%%',
          '%%lakeviewsproperty%%'
        ]);
      $fmt$, target_table, target_column, target_column, target_table, target_column);

      EXECUTE sql;
    END LOOP;
  END LOOP;
END $$;

SELECT
  table_name,
  column_name,
  record_id,
  matched_value
FROM phase4_legacy_branding_matches
ORDER BY table_name, column_name, record_id;

ROLLBACK;
