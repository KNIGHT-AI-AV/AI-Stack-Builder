import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.resolve(projectRoot, "firebase-dist");
const nextDirectory = path.resolve(projectRoot, ".next");
const sourceHtml = path.join(nextDirectory, "server", "app", "index.html");
const sourceStatic = path.join(nextDirectory, "static");
const sourceAssets = path.join(projectRoot, "public", "assets");
const sourceFavicon = path.join(projectRoot, "src", "app", "favicon.ico");
const sourceIcon = path.join(nextDirectory, "server", "app", "icon.png.body");
const sourceAppleIcon = path.join(nextDirectory, "server", "app", "apple-icon.png.body");
const sourceWebManifest = path.join(nextDirectory, "server", "app", "manifest.webmanifest.body");

if (path.dirname(outputDirectory) !== projectRoot || path.basename(outputDirectory) !== "firebase-dist") {
  throw new Error("Refusing to replace an unexpected Firebase artifact path.");
}

await requireFile(sourceHtml, "Run `npm run build` before building the Firebase artifact.");
await requireDirectory(sourceStatic, "The Next.js static chunk directory is missing.");
await requireDirectory(sourceAssets, "The reviewed public asset directory is missing.");
await requireFile(sourceFavicon, "The product favicon is missing.");
await requireFile(sourceIcon, "The built Next app icon is missing.");
await requireFile(sourceAppleIcon, "The built Next Apple icon is missing.");
await requireFile(sourceWebManifest, "The built web manifest is missing.");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, "_next"), { recursive: true });
await cp(sourceHtml, path.join(outputDirectory, "index.html"));
await cp(sourceStatic, path.join(outputDirectory, "_next", "static"), { recursive: true });
await cp(sourceAssets, path.join(outputDirectory, "assets"), { recursive: true });
await cp(sourceFavicon, path.join(outputDirectory, "favicon.ico"));
await cp(sourceIcon, path.join(outputDirectory, "icon.png"));
await cp(sourceAppleIcon, path.join(outputDirectory, "apple-icon.png"));
await cp(sourceWebManifest, path.join(outputDirectory, "manifest.webmanifest"));

const files = await collectFiles(outputDirectory);
await assertClientArtifactIsSecretFree(files);

const entries = [];
let totalBytes = 0;
for (const absolutePath of files) {
  const contents = await readFile(absolutePath);
  const relativePath = path.relative(outputDirectory, absolutePath).replaceAll(path.sep, "/");
  totalBytes += contents.byteLength;
  entries.push({
    path: relativePath,
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

const manifest = {
  schemaVersion: 1,
  product: "ai-stack-builder",
  hostingSite: "knight-ai-stack-builder",
  generatedAt: new Date().toISOString(),
  fileCount: entries.length,
  totalBytes,
  files: entries,
};
await writeFile(
  path.join(outputDirectory, ".deployment-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({ outputDirectory, fileCount: entries.length, totalBytes }, null, 2));

async function collectFiles(directory) {
  const discovered = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) discovered.push(...await collectFiles(absolutePath));
    else if (entry.isFile()) discovered.push(absolutePath);
  }
  return discovered;
}

async function assertClientArtifactIsSecretFree(files) {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg", ".txt"]);
  const forbidden = [
    /OPENROUTER_API_KEY/i,
    /ARTIFICIAL_ANALYSIS_API_KEY/i,
    /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)/i,
    /\bsk-or-v1-[A-Za-z0-9_-]{12,}/,
    /\bAIza[0-9A-Za-z_-]{20,}/,
  ];
  for (const file of files) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const contents = await readFile(file, "utf8");
    if (forbidden.some((pattern) => pattern.test(contents))) {
      throw new Error(`Client artifact contains forbidden secret material: ${path.relative(outputDirectory, file)}`);
    }
  }
}

async function requireFile(file, message) {
  try {
    if (!(await stat(file)).isFile()) throw new Error(message);
  } catch (error) {
    if (error instanceof Error && error.message === message) throw error;
    throw new Error(message, { cause: error });
  }
}

async function requireDirectory(directory, message) {
  try {
    if (!(await stat(directory)).isDirectory()) throw new Error(message);
  } catch (error) {
    if (error instanceof Error && error.message === message) throw error;
    throw new Error(message, { cause: error });
  }
}
