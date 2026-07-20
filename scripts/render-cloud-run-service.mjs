import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const infraDirectory = path.join(projectRoot, "infra", "google");
const templatePath = path.join(infraDirectory, "cloud-run.service.template.yaml");
const targetPath = path.join(infraDirectory, "target.json");
const outputPath = path.join(infraDirectory, "cloud-run.service.generated.yaml");
const receiptPath = path.join(infraDirectory, "release.generated.json");

const options = parseArguments(process.argv.slice(2));
const digest = requirePattern(options["image-digest"], /^sha256:[a-f0-9]{64}$/, "--image-digest");
const openRouterVersion = requirePattern(options["openrouter-secret-version"], /^[1-9][0-9]{0,8}$/, "--openrouter-secret-version");
const artificialAnalysisVersion = requirePattern(options["artificial-analysis-secret-version"], /^[1-9][0-9]{0,8}$/, "--artificial-analysis-secret-version");
const sourceRevision = requirePattern(options["source-revision"], /^[a-f0-9]{40}$/, "--source-revision");

const target = JSON.parse(await readFile(targetPath, "utf8"));
const imageUri = `${target.cloudRun.imageRepository}@${digest}`;
const replacements = {
  IMAGE_URI: imageUri,
  OPENROUTER_SECRET_VERSION: openRouterVersion,
  ARTIFICIAL_ANALYSIS_SECRET_VERSION: artificialAnalysisVersion,
  SOURCE_REVISION: sourceRevision,
};

let rendered = await readFile(templatePath, "utf8");
for (const [name, value] of Object.entries(replacements)) {
  rendered = rendered.replaceAll(`{{${name}}}`, value);
}
if (/{{[A-Z0-9_]+}}/.test(rendered)) throw new Error("The Cloud Run template has unresolved placeholders.");
if (/\b(?:latest|LATEST)\b/.test(rendered)) throw new Error("Cloud Run releases must not use an unpinned version.");

await writeFile(outputPath, rendered, "utf8");
const receipt = {
  schemaVersion: 1,
  product: target.product,
  projectId: target.projectId,
  region: target.region,
  service: target.cloudRun.service,
  imageUri,
  sourceRevision,
  secretVersions: {
    OPENROUTER_API_KEY: Number(openRouterVersion),
    ARTIFICIAL_ANALYSIS_API_KEY: Number(artificialAnalysisVersion),
  },
  serviceManifestSha256: createHash("sha256").update(rendered).digest("hex"),
  renderedAt: new Date().toISOString(),
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, receiptPath, imageUri, sourceRevision }, null, 2));

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Arguments must be supplied as --name value pairs.");
    }
    const name = key.slice(2);
    if (name in parsed) throw new Error(`Duplicate argument: ${key}`);
    parsed[name] = value;
  }
  return parsed;
}

function requirePattern(value, pattern, name) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${name} is missing or invalid.`);
  }
  return value;
}
