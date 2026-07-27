# AI Stack Builder retirement record

Status: **owner-retired / development frozen**  
Decision date: **2026-07-26**  
Deletion authorization: **none**

The owner classified AI Stack Builder as a throwaway project. This record
supersedes earlier active-product, portfolio, migration, release, and
saleability claims. It prepares a reversible archive; it does not authorize
repository deletion, secret destruction, shared-infrastructure changes, DNS
changes, provider purchases, user-data deletion, or a live retirement claim.

## Preserved source truth

| Purpose | Immutable source |
| --- | --- |
| Final product/source checkpoint | `a77407958789481136d3aae4ca5a7eba23931638` |
| Google cutover checkpoint before the final source work | `1c8ddb715d755388584930faa2aa0b841e2e0477` |
| Default-branch snapshot observed during retirement | `4c027508e9a9980aff9e2d2b291d802ece2d0deb` |
| Control-runtime branch head | `ca97065d1ffe66c24e624026dbae58f87c9706fc` |
| Source revision recorded on the live Cloud Run service | `abeac2442fd8a17ce398f11e01f6a306561b86b4` |

The retirement documentation commit descends from the final product/source
checkpoint. The portfolio checkpoint and deployed revision are intentionally
not presented as equivalent.

## Genuinely reusable generic components

These pieces may be extracted into a new repository after an independent
license, dependency, branding, and secret scan. Extraction should preserve
their originating commit and tests.

- `src/lib/layout-graph.ts` with `tests/layout-graph.test.ts`: deterministic
  graph layout and disconnected-node handling.
- `src/lib/architecture-export.ts` with
  `tests/architecture-export.test.ts`: deterministic JSON/Markdown
  architecture export.
- `src/lib/api/chat-schema.ts` and `src/lib/api/hardening.ts` with their tests:
  bounded request parsing, origin checks, safe public errors, concurrency and
  rate-limit primitives.
- `src/lib/api/metrics-cache.ts` with `tests/metrics-cache.test.ts`: bounded
  cache with stale-on-provider-error behavior.
- `scripts/verify-deployment.mjs`, the deployment contract test, and the
  non-root/immutable-container checks as a Google runtime verification pattern.
- The deterministic brand derivation script and generation receipt as a build
  provenance pattern. The generated AI Stack Builder identity itself is
  preserved archival material, not a reusable fleet brand.

The product UI, copy, provider recommendations, generated identity, domain,
and service names are not generic components.

## Observed live and billable inventory

The following was observed from the 2026-07-26 fleet handoff and refreshed with
read-only HTTP/DNS checks during this retirement audit. It is an inventory, not
a claim that retirement is complete.

### Endpoints and routes

- `https://aistack.knightaiav.com/`: HTTP 200 application shell.
- `https://knight-ai-stack-builder.web.app/`: HTTP 200 application shell.
- `https://ai-stack-builder-api-2wtrn4lnea-uc.a.run.app/api/health`: HTTP 200
  JSON health response for `ai-stack-builder-api` version `1.0.0`.
- The preserved browser configuration uses
  `https://ai-stack-builder-api-281371463065.us-central1.run.app` for direct
  Cloud Run API calls; its `/api/health` also returned HTTP 200.
- The stale legacy URL `https://ai-stack-builder-five.vercel.app/` returned
  HTTP 402. It is not referenced by the preserved Google-only source and has
  been removed from the GitHub repository homepage field.
- `/api/health` on the custom domain and Firebase Hosting domain currently
  returns the static application shell, not the Cloud Run JSON response.

### Hosting, runtime, artifact, and domain identifiers

- Firebase project/site: `knight-ai-av-site` /
  `knight-ai-stack-builder`.
- Hosting release:
  `projects/knight-ai-av-site/sites/knight-ai-stack-builder/channels/live/releases/1784726080589000`.
- Hosting version: `87fc457898afdc4a`, finalized at
  `2026-07-22T13:14:40.589Z`, 49 files, 5,192,488 bytes.
- Cloud Run project/region/service:
  `knight-control-20260719` / `us-central1` /
  `ai-stack-builder-api`.
- Latest ready revision: `ai-stack-builder-api-00004-slj`.
- Container digest:
  `sha256:479acd122f45daf18bfd69138b83f89cdf11cfe6fc396cf6a9aad136bf9e9f1d`.
- Artifact path:
  `us-central1-docker.pkg.dev/knight-control-20260719/knight-runtime/ai-stack-builder-api`.
- Runtime service account:
  `ai-stack-builder-runtime@knight-control-20260719.iam.gserviceaccount.com`.
- Runtime posture: minimum 0, maximum 1, concurrency 20, timeout 50 seconds,
  1 CPU, 512 MiB.
- Custom domain: `aistack.knightaiav.com`; CNAME
  `knight-ai-stack-builder.web.app`; A `199.36.158.100`; AAAA
  `2620:0:890::100`. The record lives in the shared Squarespace-managed
  `knightaiav.com` zone.

### Secret identifiers only

No secret value was read, copied, logged, changed, or deleted.

- `ai-stack-builder-openrouter-api-key`: referenced version `2`; observed
  enabled versions `1` and `2`.
- `ai-stack-builder-artificial-analysis-api-key`: referenced version `1`;
  observed enabled version `1`.

Both identifiers are in `knight-control-20260719` and are attached to
`ai-stack-builder-api`.

### Billing and data boundaries

- `knight-control-20260719` is attached to billing account identifier
  `billingAccounts/01CAA1-649F01-3B288D`.
- Fleet budgets observed: `$15` trial bridge and `$80` fleet monthly. Budgets
  are alerts, not spending caps.
- The shared fleet estimate was `$28–35/month`, dominated by shared Cloud SQL;
  it is not an attributable AI Stack Builder invoice.
- Product-specific cost exposure is scale-to-zero Cloud Run execution,
  approximately 5.2 MB of Firebase Hosting content, Secret Manager versions,
  Artifact Registry storage, logging/egress, and variable provider API use.
- No AI Stack Builder dependency on Cloud SQL, Firestore, Cloud Storage,
  Firebase Auth, Supabase, Vercel, user accounts, or customer data was found in
  the reviewed source and handoff inventory.

## Shared dependency boundary

Do not delete or modify these shared resources as part of product retirement:

- Google Cloud project `knight-control-20260719`.
- Firebase project `knight-ai-av-site`.
- Artifact Registry repository `knight-runtime`.
- Billing account `billingAccounts/01CAA1-649F01-3B288D`.
- The `knightaiav.com` DNS zone and Squarespace authority.
- Fleet budgets, logging, IAM policy, or any shared Cloud SQL resources.

The Hosting site, Cloud Run service, runtime service account, secret
identifiers, product image path, and custom subdomain are product-specific, but
their removal remains an external/destructive action requiring a fresh
resource export and explicit execution approval.

## Cleanup completed in source

- Product development is frozen at `a77407958789481136d3aae4ca5a7eba23931638`.
- This branch's README no longer presents the repository as an active product
  or its source configuration as current production truth.
- This human-readable record and `retirement.manifest.json` capture immutable
  rollback identifiers without secret values.
- The public GitHub repository description now states that the product was
  retired on 2026-07-26, and its stale Vercel homepage field is empty.
- No provider dependency, paid resource, secret, DNS record, user data, or
  deployment was added or changed.

## Frozen-source verification

On 2026-07-26, after an exact `npm ci`, `npm run verify` passed:

- deterministic brand contract: 14 files;
- lint and TypeScript checks;
- 22 of 22 unit and deployment-contract tests;
- production Next.js build;
- Firebase artifact assembly: 47 files, 5,936,231 bytes; and
- immutable deployment/security contract verification.

A fresh npm registry audit reports 12 high advisories across all dependencies
and 3 high advisories in the production dependency tree (`next`, `postcss`,
and `sharp`), with no critical advisories. The direct `next` advisory reports
`16.2.12` as a fix. No automatic or breaking dependency upgrade was applied to
this retired product. These advisories are additional evidence against leaving
the live runtime available indefinitely.

## Rollback and intentionally pending actions

| Pending action | Why it is pending | Minimum rollback evidence required first |
| --- | --- | --- |
| Publish a static retirement/410 page to Firebase Hosting | This changes a live public surface. | Export current site/version metadata and retain version `87fc457898afdc4a` plus the exact deploy artifact and hash. |
| Remove Cloud Run traffic or delete `ai-stack-builder-api` | This changes or destroys a live service. | Export full service YAML/IAM, retain revision `ai-stack-builder-api-00004-slj`, source `abeac244…`, image digest, and verify a no-secret tombstone or traffic rollback. |
| Disable Secret Manager versions | Disabling is reversible but can break rollback until re-enabled. | Detach the live service first, record IAM and version states, then disable rather than destroy. |
| Delete secrets, service account, images, or repository | Destructive and not authorized. | Explicit owner approval, dependency scan, retention period, and immutable offline/source receipts. |
| Change `aistack.knightaiav.com` | The subdomain is inside a shared zone. | Full zone export, owner DNS authorization, propagation plan, and previous-record receipt. |
| Archive the GitHub repository | It changes collaboration and release behavior. | Land the retirement record on the default branch, confirm the final remote commits/tags, then use the verified `KNIGHT-AI-AV` account. |
| Remove fleet-catalog references | The available local catalog checkout was stale and on an unrelated branch. | Update from the current private default branch in an isolated clean worktree, then change lifecycle to `retired` without deleting history. |

GitHub metadata rollback: restore the prior description, `AI Stack Builder is a
site where people describe what they want to build with AI, and it gives them
the workflow stack, tools, nodes, and structure to actually build it, sir.`,
and the prior homepage, `https://ai-stack-builder-five.vercel.app`. The
repository remains public, unarchived, and on default branch `main`; neither
metadata field affects source history.

Current Google CLI metadata refresh is blocked by owner OAuth reauthentication.
That blocks a fresh cloud export and makes live mutation inappropriate; it does
not invalidate the identifier-only handoff inventory or read-only endpoint
checks. No destructive step is implied by this record.
