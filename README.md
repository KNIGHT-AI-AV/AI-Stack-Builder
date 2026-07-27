# AI Stack Builder

> **Retired 2026-07-26.** The owner has classified AI Stack Builder as a
> throwaway project. Product development, promotion, and release work are
> frozen. This repository is retained only for Git history, reproducibility,
> rollback, and extraction of genuinely generic components. See
> [RETIREMENT.md](RETIREMENT.md) and
> [retirement.manifest.json](retirement.manifest.json).

The preserved application turns a plain-language product idea into a validated
architecture graph. Its public interface is a prerendered Next.js 16
application; its two server-only routes call OpenRouter for graph generation
and Artificial Analysis for current model metrics.

## Preserved source architecture

This branch records the Google-only Firebase Hosting plus scale-to-zero Cloud
Run design. It is not a claim that the recorded source exactly matches every
live resource. The immutable identifiers and observed live/deployed-source
split are recorded in the retirement manifest.

The API layer applies same-origin checks, hashed-client rate limits, bounded concurrency, strict payload and response schemas, request/provider timeouts, maximum body sizes, safe public errors, sanitized structured logs, and a bounded metrics cache with stale-on-provider-error behavior. AI output is treated as untrusted and must pass the exact graph schema before reaching the client.

## Local verification

Use Node.js 22.17.0 or later:

```powershell
npm ci
npm run verify
docker.exe build --pull=false --tag ai-stack-builder-api:local .
```

`npm run verify` checks the generated-brand contract, lint, type checking, unit/contract tests, the production Next build, Firebase artifact assembly, and manifest/hash/security verification. See [infra/google/README.md](infra/google/README.md) for the immutable release-rendering contract and the actions that remain intentionally outside local preparation.

## Brand identity

The AI Stack Builder mark was generated with the image model, cleaned to a true-alpha master, and deterministically derived into web, PWA, favicon, and opaque Apple/iOS assets. The untouched source, exact prompt, hashes, and cleanup method are recorded in [the generation receipt](public/assets/brand/generation-receipt.md).

```powershell
python -m pip install -r scripts/requirements-brand.txt
npm run brand:build
npm run brand:check
```

Firebase Hosting receives the manifest, framework icons, and direct raster assets in the immutable static artifact. UI images are deliberately unoptimized so the static surface never depends on a Next image-optimization route.

## Runtime configuration

The reviewed names and defaults are recorded in `infra/google/environment.manifest.json`. Local API testing requires server-only values for `OPENROUTER_API_KEY` and `ARTIFICIAL_ANALYSIS_API_KEY`; keep them in a local ignored environment file or process environment. Do not add provider credentials to source, logs, Firebase Hosting, browser storage, or any `NEXT_PUBLIC_` variable.
