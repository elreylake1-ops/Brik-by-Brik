# Phase 5A-3E - Vercel Ownership Clarification

## Purpose

This note records read-only Vercel ownership and deployment observations after Phase 5A-3 was merged into `main`.

No deployment was run. No Vercel settings, aliases, environment variables, project links, repository settings, UI, API, migrations, config, database persistence, Investor Shield authority, gate-clearing, pipeline state, True MAO, scoring, Phase 5B, or Market History work was changed.

## Repository State Observed

```text
Branch: main
HEAD: 132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
origin/main: 132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
Remote: https://github.com/elreylake1-ops/Brik-by-Brik.git
Working tree: clean before documentation changes
```

## Vercel CLI State Observed

```text
Vercel CLI: 54.2.0
Project scope listed by CLI: brikbybrik-engine
Project name: brik-by-brik-engine
Latest production URL: https://brik-by-brik-engine-chi.vercel.app
Node version: 24.x
```

Local `.vercel/project.json` links this checkout to:

```text
Project ID: prj_AbokvX7ZPyaX9zw3i7U579Q2bzNb
Org ID: team_iIqoB5QTKVCU0i9LtSuY6keD
Project name: brik-by-brik-engine
```

`vercel project inspect brik-by-brik-engine --scope brikbybrik-engine` reported:

```text
Project: brikbybrik-engine/brik-by-brik-engine
Owner: Brikbybrik Engine
Framework: Next.js
Root Directory: .
Build Command: npm run build or next build
```

## Deployment URLs Observed

### Controlled Brikbybrik Engine Deployment

`vercel inspect https://brik-by-brik-engine-gr8z1e2nf-brikbybrik-engine.vercel.app --scope brikbybrik-engine` reported:

```text
Deployment ID: dpl_3TafbcepjTCndSsRcv9U1T6zdMPp
Project name: brik-by-brik-engine
Context: brikbybrik-engine
Target: production
Status: Ready
URL: https://brik-by-brik-engine-gr8z1e2nf-brikbybrik-engine.vercel.app
```

The same deployment was resolved from the production alias:

```text
https://brik-by-brik-engine-chi.vercel.app
```

Aliases observed for the deployment:

```text
https://brik-by-brik-engine-chi.vercel.app
https://brik-by-brik-engine-brikbybrik-engine.vercel.app
https://brik-by-brik-engine-git-main-brikbybrik-engine.vercel.app
```

`curl -I https://brik-by-brik-engine-chi.vercel.app` returned `HTTP/1.1 200 OK`.

### Coffee-on-mes Deployment URL

`vercel inspect https://brik-by-brik-engine-rh7izs7q6-coffee-on-mes-projects.vercel.app --scope brikbybrik-engine` returned:

```text
Error: Can't find the deployment "brik-by-brik-engine-rh7izs7q6-coffee-on-mes-projects.vercel.app" under the context "brikbybrik-engine"
```

Running the same inspect without `--scope` also did not find the deployment in the CLI default context.

`curl -I https://brik-by-brik-engine-rh7izs7q6-coffee-on-mes-projects.vercel.app` returned `HTTP/1.1 302 Found` to Vercel SSO. This proves the URL exists behind Vercel protection, but it does not prove ownership from this CLI session.

## GitHub Deployment / Status Metadata Observed

GitHub API records for repository `elreylake1-ops/Brik-by-Brik` and commit:

```text
132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
```

showed one Vercel deployment:

```text
Environment: Production - brik-by-brik-engine
Creator: vercel[bot]
Ref: 132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
SHA: 132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
State: success
```

The deployment statuses listed both environment URLs:

```text
https://brik-by-brik-engine-rh7izs7q6-coffee-on-mes-projects.vercel.app
https://brik-by-brik-engine-gr8z1e2nf-brikbybrik-engine.vercel.app
```

GitHub commit statuses for the same repository and commit also listed successful Vercel statuses for:

```text
https://vercel.com/coffee-on-mes-projects/brik-by-brik-engine/AxgGmdejLw2DMkM7hdyW83tmVYUm
https://vercel.com/brikbybrik-engine/brik-by-brik-engine/3TafbcepjTCndSsRcv9U1T6zdMPp
```

## Clarification

Observed from GitHub, `coffee-on-mes-projects` appears in a Vercel status URL as the Vercel account/team slug for a project named `brik-by-brik-engine`. The GitHub deployment/status records attach both the `coffee-on-mes-projects` URL and the `brikbybrik-engine` URL to the same controlled GitHub repository commit:

```text
elreylake1-ops/Brik-by-Brik
132d73d7f490f7b24dcdcbfa437bd9b5a67c411a
```

However, the local Vercel CLI session could not inspect the `coffee-on-mes-projects` deployment under the `brikbybrik-engine` scope. Therefore, full ownership of the `coffee-on-mes-projects` account/team cannot be confirmed from CLI output alone.

What is confirmed:

- The local checkout is linked to Vercel project `brik-by-brik-engine`.
- The linked Vercel project is under scope `brikbybrik-engine`.
- The linked Vercel project owner is displayed as `Brikbybrik Engine`.
- The production alias `https://brik-by-brik-engine-chi.vercel.app` resolves to the Ready production deployment `dpl_3TafbcepjTCndSsRcv9U1T6zdMPp`.
- GitHub records show Vercel success statuses for repository `elreylake1-ops/Brik-by-Brik` at merge commit `132d73d7f490f7b24dcdcbfa437bd9b5a67c411a`.
- GitHub records show both observed Vercel URLs attached to that same repository commit.

What remains to verify in the Vercel dashboard:

- Whether `coffee-on-mes-projects` is an expected Vercel account/team connected to the Brik by Brik deployment workflow.
- Whether the `coffee-on-mes-projects` project access is intentionally controlled by the same approved owner/admin group.
- Whether the dual Vercel statuses for the same GitHub commit are expected and should remain active.

## Result

VERCEL OWNERSHIP CLARIFICATION RECORDED - DASHBOARD CONFIRMATION STILL REQUIRED FOR COFFEE-ON-MES ACCOUNT OWNERSHIP
