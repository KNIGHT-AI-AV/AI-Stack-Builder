import { createRequire } from "node:module";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextDirectory = path.join(root, "node_modules", "next");
const nestedSharp = path.join(nextDirectory, "node_modules", "sharp");

const rootSharp = JSON.parse(await readFile(path.join(root, "node_modules", "sharp", "package.json"), "utf8"));
if (!isSafe(rootSharp.version)) {
  throw new Error(`The root Sharp runtime is not patched: ${rootSharp.version}`);
}

try {
  const nested = JSON.parse(await readFile(path.join(nestedSharp, "package.json"), "utf8"));
  if (!isSafe(nested.version)) await rm(nestedSharp, { recursive: true, force: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const requireFromNext = createRequire(path.join(nextDirectory, "package.json"));
const resolvedMain = requireFromNext.resolve("sharp");
const resolved = JSON.parse(await readFile(path.resolve(path.dirname(resolvedMain), "..", "package.json"), "utf8"));
if (!isSafe(resolved.version)) {
  throw new Error(`Next.js still resolves an unsafe Sharp runtime: ${resolved.version}`);
}
console.log(`Next.js Sharp runtime verified: ${resolved.version}`);

function isSafe(version) {
  const [major, minor] = String(version).split(".").map(Number);
  return major > 0 || minor >= 35;
}
