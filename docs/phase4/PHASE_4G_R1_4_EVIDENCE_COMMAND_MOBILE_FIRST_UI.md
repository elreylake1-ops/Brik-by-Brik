# Phase 4G-R1-4 Evidence Command Mobile-First UI

## Purpose
Update the existing Evidence Lite panel into a phone-first Evidence Command capture and display surface without changing API routes, repositories, migrations, Investor Review, or governance logic.

## Files Changed
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `__tests__/evidence-lite-panel.test.tsx`
- `docs/phase4/PHASE_4G_R1_4_EVIDENCE_COMMAND_MOBILE_FIRST_UI.md`

## UI Fields Added
- evidence type
- linked Investor Shield gate
- linked professional gate
- title
- evidence summary
- evidence status
- evidence strength
- review state
- blocker impact
- recommended next action
- expiry / update date
- source
- mobile capture note

## Display Behavior
- Captured records show the title, evidence type, linked Investor Shield gate, professional gate, evidence summary, status, strength, review state, blocker impact, recommended next action, expiry / update date, source, and mobile capture note when present.
- Existing records remain readable even when some structured fields are missing.
- Status, strength, review state, and blocker impact are rendered with visible text and tone cues.

## Mobile-First Behavior
- The capture form is stacked by default and stays readable on a phone viewport.
- Selects, inputs, and textareas are arranged in a single-column flow that can expand on larger screens without changing the mobile order.
- Stable `data-testid` hooks were added for each form field and record section.

## Blocker / Caution Visibility
- Blocker impact is shown in visible text.
- Caution-only and manual-review records remain explicit in the list.
- The panel does not imply automatic gate satisfaction or progression.

## Photo / Video Placeholder Boundary
- `PHOTO_EVIDENCE` and `VIDEO_EVIDENCE` remain structured evidence types only.
- No upload input, OCR flow, media processing path, or file storage path was added.

## Governance Boundary
- No approve, waive, clear-gate, or move-stage actions were added.
- No saved-deal status change, pipeline move, True MAO change, formula change, classification change, capital protection change, or governance threshold change was added.

## Mocked Test Coverage
- Form fields render with stable labels and test ids.
- Photo and video appear as selectable structured evidence types.
- No upload input exists.
- No prohibited governance buttons exist.
- Structured evidence records render blocker, caution, and manual-review visibility.
- Structured evidence can be submitted through the mocked API path and appears in the panel.

## Explicit Non-Implementation
- No API route changes.
- No repository changes.
- No migrations.
- No Investor Review integration.
- No production access.
- No deployment.
- No release tag.
- No PDF generation.
- No Phase 5 work.

## Result
PHASE 4G-R1-4 EVIDENCE COMMAND MOBILE-FIRST UI COMPLETE — READY FOR 4G-R1-5 INVESTOR REVIEW INTEGRATION
