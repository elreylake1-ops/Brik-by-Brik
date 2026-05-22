# Phase 4A Step 4L-K Saved Deals List UI Boundary

## Purpose
This document defines the minimum safe boundary for adding saved deals list UI.

## Current Capability
- analysed deal can be saved from calculator UI
- saved deals can be listed through `GET /api/saved-deals`
- individual saved deal can be fetched through `GET /api/saved-deals/[id]`
- no saved deals list UI exists yet
- no saved deal detail/reopen UI exists yet

## Recommended UI Placement
- add a simple Saved Deals section below or beside the calculator in `app/page.tsx`
- fetch `GET /api/saved-deals`
- show `address`, `classification`, `pipeline_state`, `created_at`
- include a basic `View` affordance later, but no detail UI yet in this step

## List UI Boundary
- list UI should not reload deterministic engine
- list UI should not mutate saved deals
- list UI should not archive/edit yet
- list UI should not move pipeline state
- list UI should not show command view yet
- list UI should handle loading/error/empty states

## Recommended Next Step
Phase 4A Step 4L-L - Minimal Saved Deals List UI Only.
