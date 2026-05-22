# Phase 4A Local Env Setup

## Purpose
Provide a local placeholder configuration for Phase 4A Live DB Acceptance QA without committing secrets.

## Local-only .env.local
- `.env.local` is for local machine use only.
- Do not commit real credentials or connection strings.

## DATABASE_URL Placeholder Format
- `DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_DATABASE_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"`

## Where to Get the Real Value
- Supabase Dashboard -> Project -> Connect -> Connection string (pooler/direct as required by your setup).

## Security Reminder
- Never commit real secrets.
- Keep `.env.local` untracked/ignored.

## Phase 4A QA Reminder
- Apply namespaced Phase 4A migrations (`lake_views_property` schema) before running live DB acceptance QA.
