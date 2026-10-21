# Task 6C: test harness and real-video readiness

Status: local QA only. No Production, Preview, remote database, paid AI call or genuine-video upload is authorized by this work.

## Portable local identity simulator

The HTTPS identity simulator uses the test-only `selfsigned` development dependency instead of an `openssl` executable. It creates a one-day P-256 certificate with `DNS:localhost` and `IP:127.0.0.1` subject alternative names. The private key stays in process memory. Only the public certificate is written under git-ignored `.qa-local` so the production-build child can trust that exact certificate through its scoped `NODE_EXTRA_CA_CERTS` environment variable.

Existing safety boundaries remain: explicit isolated-QA confirmation, hosted-environment refusal, loopback binding, random synthetic identities, and deletion of the temporary public certificate on close. TLS verification is not disabled.

## Android genuine-video check

Use [ANDROID_CAPTURE_TEST.md](./ANDROID_CAPTURE_TEST.md). The USB/ADB path is preferred because it keeps the capture-check page on localhost and exposes no application API. Record device, Android, browser, container, codec, duration, size, decode result, captured-frame count, timestamp differences, extraction failures and browser memory/performance symptoms.

No real-device result exists until a person runs that checklist on an Android device. Genuine property footage must remain inside the browser on the device and must not be sent to an AI provider or external service.

## Live AI provider readiness

Paid analysis remains disabled by default. `selectAnalysisProvider` constructs the Claude adapter only when every gate is present:

- `VIEWING_AI_PROVIDER=claude`
- `VIEWING_AI_ENABLED=true`
- `ANTHROPIC_API_KEY` is present
- `VIEWING_AI_MODEL` exists in the local verified price table
- `VIEWING_CHECKLIST_WORDING_APPROVED=true`

Missing gates are reported by name only. The fixture provider is the default. This task does not set any gate, read credentials, provision infrastructure, or make an external AI request.

Prices were checked on 21 October 2026 against Anthropic's first-party pricing page: <https://platform.claude.com/docs/en/about-claude/pricing>. The configured standard global prices match:

| Model ID | Input USD/MTok | Output USD/MTok | Cache read USD/MTok |
|---|---:|---:|---:|
| `claude-opus-5-5` | 4.00 | 20.00 | 0.20 |
| `claude-sonnet-5-5` | 2.00 | 10.00 | 0.10 |
| `claude-haiku-5-5` | 0.10 | 0.50 | 0.01 |
| `claude-fable-5-1` | 10.00 | 50.00 | 0.25 |

Haiku prompts above 100,000 tokens retain the configured higher $0.50 input and $2.50 output rates. Five-minute cache writes retain the documented 1.25x input multiplier. US-only inference would add 10%; the current adapter does not request it.

The approved allowance remains $150: a $120 application hard stop plus a $30 reserve that the application never spends. Before each sequential paid run, the server prices the worst case using at most 40 frames, 1,600 assumed input tokens per frame, 6,000 prompt tokens and 16,000 output tokens. It refuses a run when recorded spend plus that bound would exceed $120, and limits recorded paid runs to 25 per UTC day.

The initial paid pilot must remain single-operator and sequential. Budget admission is not an atomic reservation across simultaneous assessments, so concurrent paid starts require a separate reservation design before multi-user activation. This does not expose spend now because paid activation remains off.

Before the first controlled live assessment:

1. Confirm checklist reuse rights and set the wording gate only after written approval.
2. Confirm consent and data-handling terms for the selected non-sensitive test frames.
3. Recheck the exact model ID and prices against the first-party page.
4. Measure prompt and image tokens with Anthropic's free token-counting endpoint.
5. Confirm request-duration support for the 120-second deadline.
6. Implement atomic budget reservation before permitting concurrent paid runs.
7. Obtain the API credential through the approved secret-management path; never put it in Git or logs.
8. Authorize one named operator, one assessment and one sequential paid run.
9. Review ledger cost, findings, refusal handling and human-review output before any second run.

## Local validation on 21 October 2026

- Portable-certificate regression and Task 6B financial-flow regression: 28 passed.
- Full non-PostgreSQL suite: 2,155 passed; 127 PostgreSQL-gated tests skipped in that invocation.
- Existing isolated PostgreSQL container: 126 passed, including all 17 authenticated live-server tests against a fresh production build.
- ESLint: passed.
- Production build: passed.
- Standalone TypeScript: the same 80 diagnostics as the pre-Task-6C baseline, all in existing test fixtures and type-compatibility tests; Task 6C added none.

The real Android/device checklist remains unexecuted. No paid provider call was made. The dependency audit still reports unrelated repository advisories; none names `selfsigned`, `@peculiar/*` or `pkijs`.
