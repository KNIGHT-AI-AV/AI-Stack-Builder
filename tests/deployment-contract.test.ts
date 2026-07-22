import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relativePath: string) => readFile(path.join(projectRoot, relativePath), "utf8");
const readJson = async (relativePath: string) => JSON.parse(await readText(relativePath));

test("Firebase Hosting stays static and the client targets the control-project API", async () => {
  const firebase = await readJson("firebase.json");
  const target = await readJson("infra/google/target.json");
  assert.equal(firebase.hosting.site, "knight-ai-stack-builder");
  assert.equal(firebase.hosting.public, "firebase-dist");
  assert.deepEqual(firebase.hosting.rewrites, [{ source: "**", destination: "/index.html" }]);
  assert.equal(target.runtimeProjectId, "knight-control-20260719");
  assert.equal(target.hostingProjectId, "knight-ai-av-site");
  assert.match(target.hosting.apiBaseUrl, /^https:\/\/ai-stack-builder-api-[0-9]+\.us-central1\.run\.app$/);
  assert.equal(target.cloudRun.minimumInstances, 0);
  assert.equal(target.cloudRun.maximumInstances, 1);
  assert.equal(target.cloudRun.requestTimeoutSeconds, 50);
});

test("secret bindings use fleet names, numeric pins, and no client variables", async () => {
  const environment = await readJson("infra/google/environment.manifest.json");
  assert.deepEqual(environment.secretEnvironment, {
    OPENROUTER_API_KEY: {
      secretId: "ai-stack-builder-openrouter-api-key",
      versionPolicy: "numeric-pinned",
    },
    ARTIFICIAL_ANALYSIS_API_KEY: {
      secretId: "ai-stack-builder-artificial-analysis-api-key",
      versionPolicy: "numeric-pinned",
    },
  });
  assert(!Object.keys(environment.plainEnvironment).some((name) => /(?:KEY|SECRET|TOKEN)/i.test(name)));
  assert.equal(environment.plainEnvironment.AI_STACK_PUBLIC_URL, "https://aistack.knightaiav.com");
  assert.match(environment.plainEnvironment.AI_STACK_ALLOWED_ORIGINS, /(?:^|,)https:\/\/aistack\.knightaiav\.com(?:,|$)/);
  assert.equal(environment.plainEnvironment.NEXT_PUBLIC_AI_STACK_API_BASE_URL, "https://ai-stack-builder-api-281371463065.us-central1.run.app");
  assert.equal("PORT" in environment.plainEnvironment, false);
});

test("Firebase release build injects the reviewed API origin deterministically", async () => {
  const releaseBuilder = await readText("scripts/build-firebase-release.mjs");
  assert.match(releaseBuilder, /environment\.manifest\.json/);
  assert.match(releaseBuilder, /NEXT_PUBLIC_AI_STACK_API_BASE_URL/);
  assert.match(releaseBuilder, /npm_execpath/);
});

test("Cloud Run template is scale-to-zero, non-floating, and health checked", async () => {
  const template = await readText("infra/google/cloud-run.service.template.yaml");
  assert.match(template, /autoscaling\.knative\.dev\/minScale: "0"/);
  assert.match(template, /autoscaling\.knative\.dev\/maxScale: "1"/);
  assert.match(template, /image: "{{IMAGE_URI}}"/);
  assert(!/image:\s*[^\r\n]*:latest\b/i.test(template));
  assert.equal(template.split("path: /api/health").length - 1, 2);
  assert.match(template, /serviceAccountName: ai-stack-builder-runtime@knight-control-20260719\.iam\.gserviceaccount\.com/);
  assert.doesNotMatch(template, /^\s*traffic:/m);
});

test("server routes contain hardening controls and client code contains no provider secret names", async () => {
  const chat = await readText("src/app/api/chat/route.ts");
  const metrics = await readText("src/app/api/metrics/route.ts");
  for (const expected of ["corsResponseHeaders", "assertRateLimit", "readBoundedJson", "fetchWithTimeout"]) {
    assert(chat.includes(expected), `Chat route is missing ${expected}.`);
    assert(metrics.includes(expected), `Metrics route is missing ${expected}.`);
  }
  assert(chat.includes("readJsonObject(request, 8_192)"));
  assert(chat.includes("ConcurrencyGate"));
  assert(metrics.includes("MetricsCache"));
  assert(metrics.includes("stale-if-error"));

  const clientFiles = [
    "src/app/page.tsx",
    "src/components/ChatUI.tsx",
    "src/components/GraphUI.tsx",
  ];
  const clientText = (await Promise.all(clientFiles.map(readText))).join("\n");
  assert(!clientText.includes("OPENROUTER_API_KEY"));
  assert(!clientText.includes("ARTIFICIAL_ANALYSIS_API_KEY"));
  assert(!/NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)/i.test(clientText));
});

test("Firebase artifact assembly includes the generated product identity without an image optimizer dependency", async () => {
  const builder = await readText("scripts/build-firebase.mjs");
  const layout = await readText("src/app/layout.tsx");
  const topNav = await readText("src/components/TopNav.tsx");
  const chat = await readText("src/components/ChatUI.tsx");

  for (const expected of ["icon.png", "apple-icon.png", "manifest.webmanifest"]) {
    assert(builder.includes(expected), `Firebase builder does not include ${expected}.`);
  }
  assert(layout.includes('manifest: "/manifest.webmanifest"'));
  assert(topNav.includes("ai-stack-builder-icon-192.png"));
  assert(chat.includes("ai-stack-builder-icon-192.png"));
  assert(topNav.includes("unoptimized"));
  assert(chat.includes("unoptimized"));
});
