# Phase 4A Step 4L-A DB Client + Server Adapter

## Scope Completed
- installed minimal server-side Postgres client: `pg`
- no ORM installed
- no migration framework installed
- no repository helpers implemented
- no DB CRUD behavior implemented

## Environment Variable Setup
- `DATABASE_URL` is required by the server adapter at runtime
- adapter throws a clear error if `DATABASE_URL` is missing when accessed
- credentials remain server-side only and are never exposed client-side

## Server Adapter Summary
- file: `lib/db/postgres.ts`
- uses lazy `pg` `Pool` initialization
- exports:
  - `getPostgresPool()` for server-side pool access
  - `query()` small query helper
- does not execute queries on import
- does not import UI, app, or calculator/engine modules

## Runtime Boundary
- this step adds only DB client install and adapter surface
- no live repository behavior yet
- no API routes, UI wiring, command view wiring, or calculator wiring added

## Recommended Next Step
Phase 4A Step 4L-B - Saved Deal Repository Helpers Only.
