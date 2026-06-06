# Phase 4D-0E Investor Shield UI Subphase Plan

## Purpose
This document defines the future Phase 4D UI implementation sequence, but adds no UI code.

## Current Phase 4D Planning Baseline
- 4D-0A scope boundary complete
- 4D-0B UI surfaces identified
- 4D-0C gate display model defined
- 4D-0D warning copy defined
- no UI code exists yet

## Recommended UI Implementation Sequence

### 4D-1 Read-Only Investor Shield UI Data Adapter
Goal:  
Create read-only UI-facing data shape from existing backend state.

Boundary:
- no visual panel yet
- no writes
- no evidence upload
- no task creation
- no route redesign

### 4D-2 Saved Deal Gate Summary Panel
Goal:  
Show top-level Investor Shield gates on saved deal detail view.

Boundary:
- read-only
- compact summary only
- no evidence upload
- no AI review
- no PDF

### 4D-3 Gate Detail Rows / Missing Evidence Display
Goal:  
Show each gate status, severity, confidence, evidence count, and missing evidence summary.

Boundary:
- display only
- no editing
- no upload

### 4D-4 Blocked Movement Message Display
Goal:  
Show clear copy when protected movement is blocked or needs review.

Boundary:
- no pipeline behavior changes
- display existing route result only

### 4D-5 Task Recommendation / Existing Task Display
Goal:  
Show Investor Shield-related follow-up tasks if already persisted.

Boundary:
- no new task creation from UI
- no task mutation from UI

### 4D-6 Manual Review / Waiver Indicator Display
Goal:  
Show waived/manual review states and whether reason is present.

Boundary:
- display only
- no waiver editing yet

### 4D-7 UI Runtime Proof
Goal:  
Verify UI displays backend Investor Shield state correctly.

Boundary:
- no new product scope

## Recommended First Build Step
Phase 4D-1 — Read-Only Investor Shield UI Data Adapter

## Still Excluded From Phase 4D
- AI
- image/video review
- evidence upload UI
- PDF investor pack
- CRM expansion
- scraping
- automation
- heavy dashboard expansion
- formula/classification changes

## Production Ownership Note
Phase 4A production ownership/retest remains a priority. GitHub, Vercel, and Supabase ownership must be clean before production-ready classification.
