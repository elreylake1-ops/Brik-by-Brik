# Phase 2 Scenario Actual Outputs

## Validation Summary

- Total tested: 15
- Passed: 15
- Failed: 0
- Consistency: Passed
- Governance override: Passed
- Edge cases: Passed

## Full JSON Reference

- Machine-readable validation outputs: [phase2-stress-test-results.json](../../validation/phase2-stress-test-results.json)

This JSON file contains the machine-readable actual outputs used for validation.

## Scenario 1. Strong BRRR candidate

- Purpose / what the scenario tests: Healthy margin, safe capital use, and complete supporting evidence as the clean baseline pass case.
- Expected governance state: `PASS`
- Actual governance state: `PASS`
- Expected final classification: `HOT_OR_WARM`
- Actual final classification: `HOT`
- Raw heat score and band: `100 / HOT`
- Final strategy outcome: `BRRR`
- Next action: `proceed-under-governance`
- Risk flags: None
- Pass/fail result: `PASS`
- What the result proves: The engine can identify a clean, strong case and keep it stable across repeated runs without governance friction.

## Scenario 2. Marginal deal

- Purpose / what the scenario tests: Thin-margin deal that still works but must remain cautionary rather than being inflated into a strong case.
- Expected governance state: `PASS`
- Actual governance state: `PASS`
- Expected final classification: `MARGINAL`
- Actual final classification: `MARGINAL`
- Raw heat score and band: `64 / MARGINAL`
- Final strategy outcome: `FLIP`
- Next action: `proceed-under-governance`
- Risk flags: `GDV Evidence Gate`
- Pass/fail result: `PASS`
- What the result proves: Borderline economics remain clearly flagged as marginal and are not overstated by the engine.

## Scenario 3. No deal

- Purpose / what the scenario tests: Loss-making deal with capital overexposure that should fail cleanly and consistently.
- Expected governance state: `BLOCKED`
- Actual governance state: `BLOCKED`
- Expected final classification: `NO_DEAL`
- Actual final classification: `NO_DEAL`
- Raw heat score and band: `30 / COLD`
- Final strategy outcome: `NO_DEAL`
- Next action: `resolve-fatal-risk`
- Risk flags: `Negative realistic profit`, `Fatal downside loss`, `Capital Protection Gate`, `Downside Loss Gate`, `Finance/Time Risk Gate`, `Fatal Risk Gate`, `Downside GDV creates a loss`
- Pass/fail result: `PASS`
- What the result proves: Capital-protection logic blocks a clearly unsafe deal rather than routing it into review or negotiation.

## Scenario 4. Downside loss

- Purpose / what the scenario tests: Workable realistic case where a defined downside GDV turns the deal negative and should trigger caution.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `68 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `verify-downside-gdv`
- Risk flags: `Downside Loss Gate`, `GDV Evidence Gate`, `Downside GDV creates a loss`
- Pass/fail result: `PASS`
- What the result proves: The engine separates raw attractiveness from downside protection and forces manual challenge when the downside case breaks.

## Scenario 5. Weak GDV evidence

- Purpose / what the scenario tests: Strong-looking numbers with weak comparable support that governance should pause for review.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `77 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `obtain-comparables`
- Risk flags: `GDV Evidence Gate`, `Comparable Evidence Gate`, `Weak GDV evidence`, `Thin comparable coverage`
- Pass/fail result: `PASS`
- What the result proves: Valuation evidence quality can hold back an otherwise attractive deal until support is improved.

## Scenario 6. Heavy refurb exposure

- Purpose / what the scenario tests: High refurb load relative to purchase price that should be surfaced as a capex and execution-risk case.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `68 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `builder-scope-validation`
- Risk flags: `GDV Evidence Gate`, `Refurb Exposure Gate`, `Heavy refurb exposure`, `Time/bridge risk`
- Pass/fail result: `PASS`
- What the result proves: The engine does not treat heavy refurbishment exposure as a clean proceed case and escalates scope challenge.

## Scenario 7. High finance cost

- Purpose / what the scenario tests: Finance drag that thins the deal enough to require tighter funding assumptions before progression.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `79 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `tighten-finance-assumptions`
- Risk flags: `GDV Evidence Gate`, `Finance/Time Risk Gate`, `Time/bridge risk`
- Pass/fail result: `PASS`
- What the result proves: The engine exposes finance drag clearly and keeps the deal in review until assumptions are tightened.

## Scenario 8. False HOT deal

- Purpose / what the scenario tests: Urgency is claimed, but the underwriting support is not strong enough to justify rush treatment.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `79 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `slow-urgency-pressure`
- Risk flags: `GDV Evidence Gate`, `False HOT urgency unsupported`
- Pass/fail result: `PASS`
- What the result proves: Sales pressure cannot bypass governance and does not create a false clean-HOT outcome.

## Scenario 9. Structural / fatal risk

- Purpose / what the scenario tests: Numerically attractive deal that still must be blocked when structural risk is severe or fatal.
- Expected governance state: `BLOCKED`
- Actual governance state: `BLOCKED`
- Expected final classification: `NO_DEAL`
- Actual final classification: `NO_DEAL`
- Raw heat score and band: `95 / HOT`
- Final strategy outcome: `NO_DEAL`
- Next action: `resolve-fatal-risk`
- Risk flags: `Fatal structural risk`, `Fatal Risk Gate`
- Pass/fail result: `PASS`
- What the result proves: Governance correctly overrides a HOT raw score when a fatal structural blocker exists.

## Scenario 10. Missing evidence / manual review

- Purpose / what the scenario tests: Investable-looking economics with missing core evidence that should pause progression.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `64 / MARGINAL`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `obtain-comparables`
- Risk flags: `GDV Evidence Gate`, `Comparable Evidence Gate`, `Missing Critical Evidence Gate`, `Missing GDV evidence`, `Missing comparables`
- Pass/fail result: `PASS`
- What the result proves: Incomplete evidence is surfaced explicitly and prevents the deal from appearing fully cleared.

## Scenario 11. Missing comparables

- Purpose / what the scenario tests: Attractive economics without usable valuation comparables to support the GDV case.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `64 / MARGINAL`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `obtain-comparables`
- Risk flags: `GDV Evidence Gate`, `Comparable Evidence Gate`, `Missing Critical Evidence Gate`, `Missing GDV evidence`, `Missing comparables`
- Pass/fail result: `PASS`
- What the result proves: A deal cannot pass as clean when the valuation case lacks comparable support.

## Scenario 12. Unrealistic GDV

- Purpose / what the scenario tests: Stretched valuation assumption that should be challenged and blocked before approval.
- Expected governance state: `BLOCKED`
- Actual governance state: `BLOCKED`
- Expected final classification: `NO_DEAL`
- Actual final classification: `NO_DEAL`
- Raw heat score and band: `64 / MARGINAL`
- Final strategy outcome: `NO_DEAL`
- Next action: `resolve-fatal-risk`
- Risk flags: `Unrealistic GDV assumption`, `Unrealistic GDV Assumption Gate`, `GDV Evidence Gate`, `Comparable Evidence Gate`, `Fatal Risk Gate`, `Weak GDV evidence`, `Thin comparable coverage`
- Pass/fail result: `PASS`
- What the result proves: The engine does not allow optimistic valuation assumptions to mask an unsafe deal.

## Scenario 13. Long bridge term

- Purpose / what the scenario tests: Extended bridge duration that increases time and finance drag beyond the ordinary base case.
- Expected governance state: `REVIEW_REQUIRED`
- Actual governance state: `REVIEW_REQUIRED`
- Expected final classification: `REVIEW_REQUIRED`
- Actual final classification: `REVIEW_REQUIRED`
- Raw heat score and band: `78 / WARM`
- Final strategy outcome: `MANUAL_REVIEW`
- Next action: `tighten-finance-assumptions`
- Risk flags: `GDV Evidence Gate`, `Finance/Time Risk Gate`, `Time/bridge risk`
- Pass/fail result: `PASS`
- What the result proves: The engine treats time drag as a real underwriting issue and escalates it before clean progression.

## Scenario 14. Zero refurb edge case

- Purpose / what the scenario tests: Zero-refurb input that should remain deterministic and not break execution or governance handling.
- Expected governance state: `PASS`
- Actual governance state: `PASS`
- Expected final classification: `HOT_OR_WARM`
- Actual final classification: `HOT`
- Raw heat score and band: `100 / HOT`
- Final strategy outcome: `BRRR`
- Next action: `proceed-under-governance`
- Risk flags: None
- Pass/fail result: `PASS`
- What the result proves: The engine handles the zero-refurb edge case safely and consistently without special-case failures.

## Scenario 15. High leverage scenario

- Purpose / what the scenario tests: Aggressive leverage that should fail capital protection.
- Expected governance state: `BLOCKED`
- Actual governance state: `BLOCKED`
- Expected final classification: `NO_DEAL`
- Actual final classification: `NO_DEAL`
- Raw heat score and band: `26 / COLD`
- Final strategy outcome: `NO_DEAL`
- Next action: `resolve-fatal-risk`
- Risk flags: `Negative realistic profit`, `Fatal downside loss`, `Capital Protection Gate`, `Downside Loss Gate`, `GDV Evidence Gate`, `Finance/Time Risk Gate`, `Fatal Risk Gate`, `Downside GDV creates a loss`, `High leverage`
- Pass/fail result: `PASS`
- What the result proves: High leverage is treated as a capital-protection failure rather than a negotiable detail.
