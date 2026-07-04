# Phase 4H-3A Investor Review Workflow SOP

## Purpose

The Investor Review is a read-only decision-support document.

## Opening a Review

1. Open the saved-deal review URL.
2. Confirm the property identity and deal ID.
3. Confirm the page loaded without an unavailable or not-found state.
4. Confirm the generated timestamp where shown.

Route pattern:

```text
/saved-deals/{deal-id}/review
```

## Review Order

Review the page in this order:

1. Property and deal overview
2. Investment summary
3. Classification and governance
4. Capital-protection status
5. Investor Shield status
6. Progression decision
7. Required hard gates
8. Advisory and caution gates
9. Evidence Lite notes
10. Missing evidence and blockers
11. Tasks and offers
12. Recommended next action
13. Confidentiality and non-reliance footer

## Status Interpretation

- `Blocked` means progression is not allowed.
- `Can Progress` means the current canonical progression result permits movement.
- `Manual Review Required` still requires human review.
- Required hard gates are authoritative.
- Advisory gates increase caution but do not replace hard gates.
- Evidence Lite is supporting information only.

Do not create new business rules.

## Operator Actions

The operator should:

- verify deal identity
- review all required gates
- review missing evidence
- review blockers and cautions
- check tasks and latest offer
- follow the canonical recommended next action
- escalate inconsistencies instead of interpreting around them

## Prohibited Actions

The Investor Review page must not be used to:

- approve or waive a gate
- alter Investor Shield status
- move pipeline state
- create or edit tasks
- create or edit offers
- change formulas or classification
- treat Evidence Lite as sufficient due diligence
- provide legal, valuation, lending, or structural advice

## Refresh and Persistence

- Refreshing reloads current server-backed data.
- The page is not a historical snapshot.
- Refresh does not itself create or modify records.
- Changed underlying records may change the current review output.

## Empty States

Expected behavior for empty or unavailable optional values:

- no Evidence Lite records: show the locked empty-state text
- no tasks: show the locked empty-state text
- no offers: show the locked empty-state text
- unavailable optional values: display the not-available label, not zero or fabricated completion

Do not treat missing values as zero or completed evidence.

## Error Handling

- Missing deal uses a safe not-found state.
- Dependency failure uses a safe unavailable state.
- Operators should record the deal ID and visible safe error.
- Do not expose or request credentials, SQL, or environment values.
- Escalate repeated failures before continuing review.

## Mobile Use

- Mobile is supported.
- The report is long.
- Operators should review every section rather than relying only on the top summary.
- Desktop is preferred for final detailed review when available.

## Audit Boundary

- The page itself performs no mutation.
- It does not generate a PDF.
- It does not create a persistent report snapshot.
- It displays canonical current-state information.

## Known Limitations

- Access-control gaps remain separately documented.
- No persistent PDF output.
- Mobile review is lengthy.
- No separate existing-deal/missing-Shield-record 404 state under the current model.

## Explicit Non-Implementation

This step does not:

- change runtime code
- change UI
- change routes
- access production
- mutate the database
- update README
- create a release tag
- begin Phase 5 work

## Result

`PHASE 4H-3A INVESTOR REVIEW WORKFLOW SOP COMPLETE — READY FOR PHASE 4H-3B EVIDENCE LITE WORKFLOW SOP`
