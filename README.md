# AI Stack Builder

AI Stack Builder turns a plain-language product idea into a validated architecture graph. Its public interface is a prerendered Next.js 16 application; its two server-only routes call OpenRouter for graph generation and Artificial Analysis for current model metrics.

## Production architecture

- Firebase Hosting site: `knight-ai-stack-builder`
- Cloud Run service: `ai-stack-builder-api` in `us-central1`
- Google Cloud project: `knight-ai-av-site`
- Runtime service account: `ai-stack-builder-runtime@knight-ai-av-site.iam.gserviceaccount.com`
- Cost posture: zero minimum instances, one maximum instance, one CPU, 512 MiB, and a 50-second request timeout
- Secrets: numeric, pinned Secret Manager versions; never client variables or image build arguments

Firebase serves the static app and immutable Next chunks directly. Only `/api/**` is rewritten to Cloud Run. The Cloud Run container uses Next standalone output, runs as a non-root user, and exposes a provider-independent `/api/health` endpoint.

The API layer applies same-origin checks, hashed-client rate limits, bounded concurrency, strict payload and response schemas, request/provider timeouts, maximum body sizes, safe public errors, sanitized structured logs, and a bounded metrics cache with stale-on-provider-error behavior. AI output is treated as untrusted and must pass the exact graph schema before reaching the client.

## Local verification

Use Node.js 22.17.0 or later:

```powershell
npm ci
npm run verify
docker.exe build --pull=false --tag ai-stack-builder-api:local .
```

`npm run verify` runs lint, type checking, unit/contract tests, the production Next build, Firebase artifact assembly, and manifest/hash/security verification. See [infra/google/README.md](infra/google/README.md) for the immutable release-rendering contract and the actions that remain intentionally outside local preparation.

## Runtime configuration

The reviewed names and defaults are recorded in `infra/google/environment.manifest.json`. Local API testing requires server-only values for `OPENROUTER_API_KEY` and `ARTIFICIAL_ANALYSIS_API_KEY`; keep them in a local ignored environment file or process environment. Do not add provider credentials to source, logs, Firebase Hosting, browser storage, or any `NEXT_PUBLIC_` variable.
