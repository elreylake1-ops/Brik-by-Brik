# Phase 4F-1A Canonical Investor Summary Type Contracts

## Purpose
Create the read-only TypeScript contracts needed for the future Investor Summary feature without adding mapper logic, repositories, routes, UI, or deterministic recalculation.

This phase is types-only. It establishes the future boundary for a pure summary mapper.

## Files Created or Changed

- `types/investor-summary.ts`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`

## Contract Inventory

Exported types:

- `InvestorSummaryRecommendedActionSource`
- `InvestorSummaryDealIdentity`
- `InvestorSummaryGdvRange`
- `InvestorSummaryTrueMaoBreakdown`
- `InvestorSummaryBlockedGate`
- `InvestorSummaryShieldSummary`
- `InvestorSummaryTaskSummary`
- `InvestorSummaryLatestOfferSummary`
- `InvestorSummaryRecommendedNextAction`
- `InvestorSummaryViewModel`

## Canonical Types Reused

- `CapitalProtectionStatus` from `types/due-diligence.ts`
- `DealClassification` from `types/due-diligence.ts`
- `InvestorShieldGateKey` from `types/investor-shield.ts`
- `InvestorShieldOverallStatus` from `types/investor-shield-enforcement.ts`
- `OfferType` from `types/operator-command.ts`
- `TaskPriority` from `types/operator-command.ts`
- `TaskStatus` from `types/operator-command.ts`
- `TaskType` from `types/operator-command.ts`

## Top-Level View Model

`InvestorSummaryViewModel` is the read-only boundary for the future summary.

Fields:

- `deal` with `dealId` and `address`
- `purchasePrice`
- `gdvRange`
- `trueMao`
- `capitalProtectionState`
- `classification`
- `investorShield`
- `activeTasks`
- `latestOffer`
- `recommendedNextAction`

Missing-state behavior:

- Monetary values use `null`, not zero.
- `capitalProtectionState` and `classification` use `null` when unavailable.
- `investorShield.overallStatus` and `investorShield.missingEvidenceCount` use `null` when shield data is unavailable.
- `activeTasks` is always a readonly array and may be empty.
- `latestOffer` is nullable.
- `recommendedNextAction` uses an explicit `UNAVAILABLE` source with `actionText: null`.

## Monetary Contracts

### Purchase Price

- Stored as `number | null`
- No formatting strings
- No derived substitute
- No zero sentinel

### GDV Range

- `downside`, `realistic`, and `strong` are each `number | null`
- The endpoints are independent
- No range synthesis occurs here
- No preferred endpoint is encoded

### True MAO

- `fifteenPercent`, `twentyPercent`, and `twentyFivePercent` are each `number | null`
- The values are independent
- No preferred MAO is defined
- No calculation occurs in this file

## Investor Shield Contract

`InvestorSummaryShieldSummary` exposes:

- `overallStatus`
- `missingEvidenceCount`
- `blockedGates`

`InvestorSummaryBlockedGate` is intentionally narrow:

- `gateKey`
- optional `label`
- optional `gateType`
- optional `blockerReason`

The contract is read-only. It does not represent approval, waiver mutation, or advisory-to-blocker conversion.

## Task Contract

`InvestorSummaryTaskSummary` is a narrow read-only projection of persisted task fields:

- `taskId`
- `title`
- `taskType`
- `status`
- `priority`
- `dueDate`
- `blockerReason`
- `createdAt`
- `completedAt`

Active-task filtering is not implemented here. The top-level model only holds an already-selected readonly array.

## Offer Contract

`InvestorSummaryLatestOfferSummary` is nullable and read-only:

- `offerId`
- `amount`
- `offerType`
- `offerStatus`
- `rationale`
- `sellerResponse`
- `createdAt`

Latest-offer selection is not implemented here. This file does not encode ordering or fallback logic.

## Recommended Action Contract

`InvestorSummaryRecommendedNextAction` uses an explicit source discriminator:

- `PERSISTED_NEXT_ACTION`
- `INVESTOR_SHIELD_FALLBACK`
- `UNAVAILABLE`

The unavailable state uses `actionText: null` and is not presented as a positive recommendation.

## Missing-State Rules

- Missing monetary values use `null`, not zero.
- Missing latest offer uses `null`.
- No blocked gates uses an empty readonly array.
- No active tasks uses an empty readonly array.
- Missing recommended action uses the explicit unavailable state.
- Missing Shield data does not default to safe.
- Missing classification or capital protection does not default to an approved state.

## Dependency and Circularity Review

- `types/investor-summary.ts` uses type-only imports from existing canonical type files.
- No repository, route, UI, or engine files import this new contract file yet.
- No circular dependency was introduced.
- No new barrel file was required because the repository does not use a `types/index.ts` barrel.

## Explicit Non-Implementation

- No fixtures
- No mapper
- No selector
- No repository
- No API route
- No UI
- No page integration
- No database query
- No migration
- No deterministic recalculation
- No Investor Shield reevaluation
- No production change

## Acceptance Conditions

1. Canonical contract file created. Pass.
2. All twelve Phase 4F fields represented. Pass.
3. Existing canonical types reused where safe. Pass.
4. Deal ID remains text-compatible. Pass.
5. GDV endpoints remain independently nullable. Pass.
6. True MAO values remain independently nullable. Pass.
7. Missing Shield state cannot default to safe. Pass.
8. Blocked gates are read-only. Pass.
9. Active tasks are represented without defining filtering. Pass.
10. Latest offer is nullable. Pass.
11. Recommended-action source is explicit. Pass.
12. No deterministic or governance logic added. Pass.
13. Build/type validation passes. Pending validation.

## Verdict

`PHASE 4F-1A COMPLETE — READY FOR PHASE 4F-1B`

## Recommended Next Step

`Phase 4F-1B — Investor Summary Contract Fixtures`
