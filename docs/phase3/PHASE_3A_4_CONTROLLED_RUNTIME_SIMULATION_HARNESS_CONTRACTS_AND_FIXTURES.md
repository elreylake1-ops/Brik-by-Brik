# Phase 3A-4 Controlled Runtime Simulation Harness Contracts and Fixtures

## Simulation Contract Scope
Step 8B defines contract shapes and locked fixtures for a future controlled runtime simulation harness.

## Fixture-Only Boundary
All simulation artifacts in this step are fixture-only and non-executable.

## No-Runtime-Wiring Rule
No simulation runner wiring is allowed into engine, orchestrator, UI, routes, or calculator runtime behavior.

## No-Live-Data Rule
No live data sources, live APIs, or external service dependencies are permitted.

## No-Persistence Rule
No database writes, telemetry storage, or persistent state updates are allowed.

## No-AI/Scraping/Integration Rule
No AI logic, scraping logic, CRM logic, or external integration behavior is allowed.

## Deterministic-Only Fixture Execution Expectation For Later Steps
Future executable simulation steps must remain deterministic and fixture-driven with repeatable outputs.

## Safe-Fail Expectations
Scenarios that threaten deterministic governance must resolve to blocked, escalated, safe-failed, drift-detected, or loop-breaker-triggered expected outcomes.

## Scenario Output Expectations
Each fixture expected output must include:
- simulationId
- runtimeMode
- governanceVersion
- scenarioName
- enforcementOutcome
- conflictDetected
- driftDetected
- loopBreakerTriggered
- telemetrySummary
- safeFailAction
- advisoryOnly
- expectedResult
