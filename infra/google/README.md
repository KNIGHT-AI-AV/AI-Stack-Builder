# Google release contract

This directory is the reviewed, zero-Vercel production contract for AI Stack Builder. Firebase Hosting serves the prerendered web shell, and rewrites only `/api/**` to the `ai-stack-builder-api` Cloud Run service. Cloud Run scales to zero and is capped at one instance so the bounded in-memory rate limits, request coalescing, and metrics cache remain coherent while traffic is small.

Nothing in this directory performs a deployment. Account login, billing enablement, IAM changes, Secret Manager writes, image pushes, Cloud Run replacement, Firebase promotion, and DNS changes are deliberately outside the preparation step.

## Runtime secrets

Only these environment names are read by server routes:

- `OPENROUTER_API_KEY` from Secret Manager ID `ai-stack-builder-openrouter-api-key`
- `ARTIFICIAL_ANALYSIS_API_KEY` from Secret Manager ID `ai-stack-builder-artificial-analysis-api-key`

Use a numeric enabled secret version for each release. Never use `latest`, put a secret value in a manifest, pass it as a Docker build argument, or expose it through a `NEXT_PUBLIC_` variable.

## Build and verify locally

```powershell
npm ci
npm run verify
docker.exe build --pull=false --tag ai-stack-builder-api:local .
```

The Firebase artifact is created in `firebase-dist`. Its deployment manifest hashes every shipped file and the verifier rejects client artifacts that contain provider-secret identifiers or common provider-token prefixes.

## Render the immutable Cloud Run release

After an image has been built and pushed by an authorized release operator, render the service file using the immutable image digest, numeric secret versions, and the exact 40-character source commit:

```powershell
node scripts/render-cloud-run-service.mjs `
  --image-digest sha256:<64-hex-digest> `
  --openrouter-secret-version <number> `
  --artificial-analysis-secret-version <number> `
  --source-revision <40-hex-commit>
```

This writes ignored local release evidence to `infra/google/cloud-run.service.generated.yaml` and `infra/google/release.generated.json`. Review those files before an authorized deployment. The deployment sequence is: provision the runtime service account and least-privilege secret access, create numeric secret versions, build and push the image, render the immutable service YAML, replace Cloud Run, smoke-test its health and APIs, deploy Firebase Hosting to a preview channel, verify redirects/assets/API behavior, and only then promote Hosting live.
