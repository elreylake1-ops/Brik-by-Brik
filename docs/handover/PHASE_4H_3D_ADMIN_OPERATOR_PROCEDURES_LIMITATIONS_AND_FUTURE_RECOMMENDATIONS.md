# Phase 4H-3D Admin Operator Procedures, Limitations, and Future Recommendations

## Purpose

This document gives final operational guidance for safely operating the Phase 4 internal review surface.

## Operator Roles and Responsibilities

An operator is responsible for the practical review workflow, not for changing governance or infrastructure authority.

The operator should:

- open and verify the correct saved deal
- review Investor Review output
- review Investor Shield status
- review Evidence Lite notes
- review missing evidence and blockers
- avoid interpreting around blocked or unavailable states
- escalate inconsistencies
- avoid entering secrets or unrelated personal data

This document does not define a formal RBAC model.

## Standard Operating Procedure

Use this sequence for ordinary review work:

1. Confirm the correct production or staging environment.
2. Confirm the correct saved deal.
3. Open Investor Review.
4. Check property identity and the generated timestamp.
5. Review deterministic classification and capital protection first.
6. Review Investor Shield status and progression decision.
7. Review required hard gates.
8. Review advisory and caution gates.
9. Review Evidence Lite notes as supporting information only.
10. Review tasks and offers.
11. Follow the canonical recommended next action.
12. Escalate if data is unavailable, contradictory, or incomplete.

## Safe Operating Rules

The operator must:

- not progress a blocked deal without formal approval
- not treat Evidence Lite as gate satisfaction
- not treat missing evidence as neutral
- not treat unavailable data as safe
- not use the system as legal, valuation, lending, planning, survey, title, or structural advice
- not expose credentials, SQL, environment values, or private infrastructure details
- not rely on mobile top summary only; review every section

## Production Safety Rules

Production activity stays controlled and narrow.

- no production mutation unless explicitly approved
- no manual database writes unless formally authorized
- no migrations unless approved and backed up
- no environment-variable changes without controlled verification
- no rollback or restore without written approval
- no release tag until James formally approves Phase 4

## Deployment and Recovery References

Use the existing handover docs as references, not as material to duplicate here:

- Vercel deployment: [`docs/handover/PHASE_4H_2B1_VERCEL_DEPLOYMENT_INSTRUCTIONS.md`](./PHASE_4H_2B1_VERCEL_DEPLOYMENT_INSTRUCTIONS.md)
- environment variables: [`docs/handover/PHASE_4H_2A_ENVIRONMENT_VARIABLE_INVENTORY.md`](./PHASE_4H_2A_ENVIRONMENT_VARIABLE_INVENTORY.md)
- database backup and recovery: [`docs/handover/PHASE_4H_2B2_DATABASE_BACKUP_AND_RECOVERY_INSTRUCTIONS.md`](./PHASE_4H_2B2_DATABASE_BACKUP_AND_RECOVERY_INSTRUCTIONS.md)
- ownership and access matrix: [`docs/handover/PHASE_4H_2C3_CONSOLIDATED_OWNERSHIP_AND_ACCESS_MATRIX.md`](./PHASE_4H_2C3_CONSOLIDATED_OWNERSHIP_AND_ACCESS_MATRIX.md)

## Known Limitations

Confirmed limitations:

- access-control gaps remain documented separately
- production ownership/access gaps remain open
- exact restore authority remains unverified
- possible production schema drift remains unverified
- no persistent PDF output
- no persistent Investor Review snapshot
- no upload/OCR/AI evidence pipeline
- no external sharing or signed links
- mobile Investor Review is lengthy
- separate existing-deal/missing-Shield-record 404 is not independently represented under the current model

## Technical Debt

Evidence-backed debt that remains:

- final ownership/access confirmation needed
- release tag pending formal approval
- production restore drill not tested
- PDF generation intentionally deferred
- access-control model requires separate decision before broader exposure
- README/index still needs final handover update in 4H-4

## Future Recommendations

### Near-term

- complete README and handover index
- complete final validation
- wait for James’s formal approval
- create release tag only after approval
- operate on real deals and gather feedback

### Later Phase 5 Candidate

- deterministic PDF generation/export after browser review approval

Explicitly exclude from future expansion:

- formula changes
- True MAO changes
- governance changes
- classification changes
- capital-protection changes
- AI/OCR
- scraping
- uploads
- CRM expansion
- automation expansion
- external sharing

## Escalation Checklist

Stop and escalate if any of the following occur:

- unavailable Investor Review
- missing deal
- Shield loading failure
- contradictory status
- blocked progression
- missing required evidence
- production access uncertainty
- environment-variable uncertainty
- suspected credential exposure
- failed deployment
- suspected data corruption

## Explicit Non-Implementation

This step does not:

- change runtime code
- change UI
- change routes
- change database data
- access production
- change environment variables
- update README
- create a release tag
- begin Phase 5 work
- generate PDF output

## Result

`PHASE 4H-3D ADMIN OPERATOR PROCEDURES COMPLETE — READY FOR PHASE 4H-4 README AND HANDOVER INDEX`
