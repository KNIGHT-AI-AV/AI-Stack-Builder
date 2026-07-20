import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relativePath: string) => readFile(path.join(projectRoot, relativePath), "utf8");
const readJson = async (relativePath: string) => JSON.parse(await readText(relativePath));

test("Firebase Hosting sends only APIs to the intended Cloud Run service", async () => {
  const firebase = await readJson("firebase.json");
  const target = await readJson("infra/google/target.json");
  assert.equal(firebase.hosting.site, "knight-ai-stack-builder");
  assert.equal(firebase.hosting.public, "firebase-dist");
  assert.deepEqual(firebase.hosting.rewrites[0], {
    source: "/api/**",
    run: { serviceId: "ai-stack-builder-api", region: "us-central1", pinTag: true },
  });
  assert.deepEqual(firebase.hosting.rewrites[1], { source: "**", destination: "/index.html" });
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
  assert(!Object.keys(environment.plainEnvironment).some((name) => name.startsWith("NEXT_PUBLIC_")));
});

test("Cloud Run template is scale-to-zero, non-floating, and health checked", async () => {
  const template = await readText("infra/google/cloud-run.service.template.yaml");
  assert.match(template, /autoscaling\.knative\.dev\/minScale: "0"/);
  assert.match(template, /autoscaling\.knative\.dev\/maxScale: "1"/);
  assert.match(template, /image: "{{IMAGE_URI}}"/);
  assert(!/image:\s*[^\r\n]*:latest\b/i.test(template));
  assert.equal(template.split("path: /api/health").length - 1, 2);
  assert.match(template, /serviceAccountName: ai-stack-builder-runtime@knight-ai-av-site\.iam\.gserviceaccount\.com/);
});

test("server routes contain hardening controls and client code contains no provider secret names", async () => {
  const chat = await readText("src/app/api/chat/route.ts");
  const metrics = await readText("src/app/api/metrics/route.ts");
  for (const expected of ["assertAllowedOrigin", "assertRateLimit", "readBoundedJson", "fetchWithTimeout"]) {
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
