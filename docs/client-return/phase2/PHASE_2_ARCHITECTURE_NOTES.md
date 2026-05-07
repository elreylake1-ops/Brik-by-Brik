# Phase 2 Architecture Notes

## Purpose

This note summarizes the logic-first architecture used to validate Brik Engine Phase 2.

## High-Level Module Map

- Validation harness
  - scenario fixtures
  - fixture validation
  - stress test structure

- Output contracts
  - Phase 2 JSON output types
  - governance and intelligence type contracts
  - validation result contracts

- Governance engines
  - fatal-risk engine
  - decision-gate engine
  - evidence-status engine
  - data-confidence engine
  - human-review engine
  - governance orchestrator

- Intelligence engines
  - deal heat score engine
  - risk radar engine
  - strategy match engine
  - investor summary engine
  - next-action engine
  - negotiation/time-risk helpers
  - Phase 2 analysis builder

- Validation runner
  - fixture-to-engine mapping
  - output validation
  - expected-vs-actual comparison
  - consistency testing
  - report generation

## Engine Flow

1. Fixture/input validation  
   Invalid fixtures are stopped before engine execution.

2. Data mapping  
   Scenario inputs are converted into the Phase 2 intelligence/governance shape explicitly.

3. Raw intelligence scoring  
   The engine computes raw deal heat, risk, strategy, and next-action signals using deterministic rules.

4. Governance execution  
   Fatal-risk, evidence, confidence, and decision-gate logic evaluate whether the deal can proceed.

5. Final classification  
   Governance, not raw score, controls the final deal state.

6. Output validation  
   The returned JSON is checked against the locked Phase 2 output contract.

7. Consistency testing  
   Identical inputs are rerun to prove deterministic stability.

## Why Governance Sits Above Scoring

Scoring shows raw attractiveness. Governance protects capital.

This separation is necessary because a numerically attractive deal may still be unsafe if:
- evidence is missing
- downside loss is unacceptable
- structural/legal/planning risk is fatal
- finance or leverage assumptions are unsafe
- valuation assumptions are not credible

Therefore governance must sit above scoring and retain final authority.

## Why Scoring Remains Deterministic and Non-Final

Scoring remains:
- rules-based
- additive/subtractive
- explainable
- deterministic

Scoring is intentionally non-final because it is not a control layer. It provides raw signal quality, while governance decides whether that signal is acceptable for progression.

## Future AI Compatibility Without Current AI Dependency

The output structure is compatible with future packaging or explanation layers, but Phase 2 contains no AI dependency.

This means:
- no AI extraction
- no AI scoring
- no AI override behavior
- no black-box decisions

If future AI-assisted features are ever approved, they can consume the structured Phase 2 outputs without replacing the deterministic control layer.
