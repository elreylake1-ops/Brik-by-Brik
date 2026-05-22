# Phase 4A Step 4L-H Saved Deal Reopen/List Boundary

## Purpose
This document defines the minimum safe boundary for listing and reopening saved deals after save works.

## Current Capability
- current analysis can be saved
- saved deal POST route exists
- saved deal repository has list/get helpers
- no list/reopen UI exists yet
- no command view exists yet

## Reopen/List Goal
- James should be able to see saved deals
- James should be able to open one saved deal
- reopening should show stored `engine_result_json`
- reopening must not recalculate deterministic result
- reopening must not mutate saved deal data

## Recommended Minimal Path
1. Add `GET /api/saved-deals` for list only.
2. Add `GET /api/saved-deals/[id]` for one saved deal only.
3. Add a minimal saved deals list section/page.
4. Add a minimal saved deal detail/read-only view.
5. Build command view later after reopen works.

## Boundaries
- no edit yet
- no archive UI yet
- no pipeline movement yet
- no offers/tasks/notes yet
- no command view yet
- no deterministic recalculation
- no engine mutation

## Recommended Next Step
Phase 4A Step 4L-I - Implement `GET /api/saved-deals` List Only.

Status note: Phase 4A Step 4L-I GET /api/saved-deals list route created. No detail route, list UI, command view, pipeline, offers, tasks, notes, evidence, or audit behavior added.
