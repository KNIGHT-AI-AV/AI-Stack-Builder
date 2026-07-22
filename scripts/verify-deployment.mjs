import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

const packageJson = await readJson("package.json");
const firebase = await readJson("firebase.json");
const firebaseRc = await readJson(".firebaserc");
const target = await readJson("infra/google/target.json");
const environment = await readJson("infra/google/environment.manifest.json");
const nextConfig = await readText("next.config.ts");
const dockerfile = await readText("Dockerfile");
const serviceTemplate = await readText("infra/google/cloud-run.service.template.yaml");

assert(packageJson.dependencies.next === "16.2.10", "Next.js must stay on the reviewed 16.2.10 release.");
assert(packageJson.devDependencies["eslint-config-next"] === "16.2.10", "eslint-config-next must match Next.js.");
assert(packageJson.overrides.postcss === "8.5.10", "The reviewed PostCSS override is missing.");
assert(nextConfig.includes('output: "standalone"'), "Next standalone output is required for Cloud Run.");
assert(nextConfig.includes("root: process.cwd()"), "The Turbopack root must be pinned to this project.");

assert(firebaseRc.projects.default === target.hostingProjectId, "Firebase Hosting project and target disagree.");
assert(target.runtimeProjectId === "knight-control-20260719", "Cloud Run is not assigned to the consolidated runtime project.");
assert(firebase.hosting.site === target.hosting.site, "Firebase Hosting site and Google target disagree.");
assert(firebase.hosting.public === target.hosting.publicDirectory, "Firebase public directory and target disagree.");
assert(firebase.hosting.rewrites.length === 1 && firebase.hosting.rewrites[0].destination === "/index.html", "Firebase Hosting must stay static without a cross-project Cloud Run rewrite.");
assert(target.hosting.apiBaseUrl === environment.plainEnvironment.NEXT_PUBLIC_AI_STACK_API_BASE_URL, "Client API origin and runtime contract disagree.");
assert(!("PORT" in environment.plainEnvironment), "Cloud Run reserves PORT and it must not be supplied explicitly.");

assert(target.cloudRun.minimumInstances === 0, "Cloud Run minimum instances must remain zero.");
assert(target.cloudRun.maximumInstances === 1, "Cloud Run maximum instances must remain one until distributed limits/cache exist.");
assert(target.cloudRun.requestTimeoutSeconds < 60, "Cloud Run timeout must stay below Firebase Hosting's request limit.");
assert(serviceTemplate.includes('autoscaling.knative.dev/minScale: "0"'), "Cloud Run minScale is not zero.");
assert(serviceTemplate.includes('autoscaling.knative.dev/maxScale: "1"'), "Cloud Run maxScale is not one.");
assert(serviceTemplate.includes("containerConcurrency: 20"), "Cloud Run concurrency is not pinned.");
assert(serviceTemplate.includes("timeoutSeconds: 50"), "Cloud Run request timeout is not pinned.");
assert(count(serviceTemplate, "path: /api/health") === 2, "Both startup and liveness probes must use /api/health.");
assert(serviceTemplate.includes('image: "{{IMAGE_URI}}"'), "Cloud Run image must be supplied by the immutable renderer.");
assert(!/image:\s*[^\r\n]*:latest\b/i.test(serviceTemplate), "Cloud Run image tags may not use latest.");
assert(serviceTemplate.includes('run.googleapis.com/invoker-iam-disabled: "true"'), "Cloud Run public access must preserve the organization-compatible invoker bypass annotation.");
assert(serviceTemplate.includes(`value: "${environment.plainEnvironment.AI_STACK_PUBLIC_URL}"`), "Cloud Run public URL and environment manifest disagree.");
assert(serviceTemplate.includes(`value: "${environment.plainEnvironment.AI_STACK_ALLOWED_ORIGINS}"`), "Cloud Run allowed origins and environment manifest disagree.");

const expectedSecrets = {
  OPENROUTER_API_KEY: "ai-stack-builder-openrouter-api-key",
  ARTIFICIAL_ANALYSIS_API_KEY: "ai-stack-builder-artificial-analysis-api-key",
};
for (const [environmentName, secretId] of Object.entries(expectedSecrets)) {
  assert(environment.secretEnvironment[environmentName]?.secretId === secretId, `Secret binding is wrong for ${environmentName}.`);
  assert(environment.secretEnvironment[environmentName]?.versionPolicy === "numeric-pinned", `Secret version policy is wrong for ${environmentName}.`);
  assert(serviceTemplate.includes(`- name: ${environmentName}`), `Cloud Run is missing ${environmentName}.`);
  assert(serviceTemplate.includes(`name: ${secretId}`), `Cloud Run is missing Secret Manager ID ${secretId}.`);
}
assert(!Object.keys(environment.plainEnvironment).some((name) => /(?:KEY|SECRET|TOKEN)/i.test(name)), "A secret-like name appears in plain environment configuration.");
assert(!serviceTemplate.includes("NEXT_PUBLIC_OPENROUTER"), "A provider secret may not use NEXT_PUBLIC_.");

assert(/^FROM node:22\.17\.0-bookworm-slim AS dependencies/m.test(dockerfile), "Docker runtime is not pinned.");
assert(dockerfile.includes("USER nextjs"), "Docker runtime must run as a non-root user.");
assert(dockerfile.includes("EXPOSE 8080"), "Docker runtime must expose port 8080.");
assert(dockerfile.includes('CMD ["node", "server.js"]'), "Docker runtime must start the standalone server.");

const manifest = await readJson("firebase-dist/.deployment-manifest.json");
assert(manifest.product === target.product, "Firebase artifact belongs to the wrong product.");
assert(manifest.hostingSite === target.hosting.site, "Firebase artifact belongs to the wrong Hosting site.");
assert(manifest.fileCount === manifest.files.length, "Firebase artifact file count is inconsistent.");
assert(manifest.fileCount > 3, "Firebase artifact is unexpectedly small.");
assert(manifest.files.some((entry) => entry.path === "index.html"), "Firebase artifact has no index.html.");
for (const requiredBrandFile of ["favicon.ico", "icon.png", "apple-icon.png", "manifest.webmanifest"]) {
  assert(manifest.files.some((entry) => entry.path === requiredBrandFile), `Firebase artifact has no ${requiredBrandFile}.`);
}
assert(manifest.files.some((entry) => entry.path.startsWith("_next/static/") && entry.path.endsWith(".js")), "Firebase artifact has no Next.js client chunks.");
assert(manifest.files.some((entry) => entry.path.startsWith("assets/")), "Firebase artifact has no product assets.");

const staticHtml = await readText("firebase-dist/index.html");
assert(!staticHtml.includes("/_next/image"), "Firebase static HTML depends on the unavailable Next image optimizer.");
const webManifest = await readJson("firebase-dist/manifest.webmanifest");
assert(webManifest.name === "AI Stack Builder by Knight AI+AV", "Web manifest has the wrong product name.");
assert(webManifest.icons.length === 4, "Web manifest must declare both any-purpose and maskable PWA icons.");
for (const icon of webManifest.icons) {
  assert(icon.src.startsWith("/assets/brand/icons/"), `Web manifest contains an unexpected icon path: ${icon.src}`);
  const relativeIcon = icon.src.slice(1);
  assert(manifest.files.some((entry) => entry.path === relativeIcon), `Firebase artifact is missing manifest icon ${relativeIcon}.`);
}

const actualFiles = (await collectFiles(path.join(projectRoot, "firebase-dist")))
  .filter((file) => path.basename(file) !== ".deployment-manifest.json");
assert(actualFiles.length === manifest.fileCount, "Firebase artifact contains an unmanifested file.");
let actualBytes = 0;
for (const entry of manifest.files) {
  assert(!entry.path.includes("..") && !path.isAbsolute(entry.path), `Unsafe artifact path: ${entry.path}`);
  const absolutePath = path.resolve(projectRoot, "firebase-dist", ...entry.path.split("/"));
  assert(absolutePath.startsWith(`${path.resolve(projectRoot, "firebase-dist")}${path.sep}`), `Artifact path escaped output: ${entry.path}`);
  const contents = await readFile(absolutePath);
  actualBytes += contents.byteLength;
  assert(contents.byteLength === entry.bytes, `Artifact size mismatch: ${entry.path}`);
  assert(createHash("sha256").update(contents).digest("hex") === entry.sha256, `Artifact hash mismatch: ${entry.path}`);
}
assert(actualBytes === manifest.totalBytes, "Firebase artifact byte total is inconsistent.");

const clientText = await collectClientText(path.join(projectRoot, "firebase-dist"));
assert(
  clientText.includes(target.hosting.apiBaseUrl),
  "Firebase client artifact does not contain the reviewed direct Cloud Run API origin.",
);
for (const pattern of [/OPENROUTER_API_KEY/i, /ARTIFICIAL_ANALYSIS_API_KEY/i, /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)/i, /\bsk-or-v1-[A-Za-z0-9_-]{12,}/]) {
  assert(!pattern.test(clientText), `Firebase client artifact matched forbidden pattern ${pattern}.`);
}

console.log(JSON.stringify({
  status: "verified",
  product: target.product,
  hostingProjectId: target.hostingProjectId,
  runtimeProjectId: target.runtimeProjectId,
  hostingSite: target.hosting.site,
  cloudRunService: target.cloudRun.service,
  minimumInstances: target.cloudRun.minimumInstances,
  fileCount: manifest.fileCount,
  totalBytes: manifest.totalBytes,
}, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

async function collectClientText(directory) {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg", ".txt"]);
  const files = await collectFiles(directory);
  const fragments = [];
  for (const file of files) {
    if (path.basename(file) === ".deployment-manifest.json") continue;
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    if ((await stat(file)).size > 16_000_000) throw new Error(`Client text file is unexpectedly large: ${file}`);
    fragments.push(await readFile(file, "utf8"));
  }
  return fragments.join("\n");
}
