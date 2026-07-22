import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environmentManifest = JSON.parse(
  await readFile(path.join(projectRoot, "infra", "google", "environment.manifest.json"), "utf8"),
);

const publicApiOrigin = environmentManifest?.plainEnvironment?.NEXT_PUBLIC_AI_STACK_API_BASE_URL;
if (typeof publicApiOrigin !== "string" || !/^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(publicApiOrigin)) {
  throw new Error("The reviewed Firebase build is missing a valid NEXT_PUBLIC_AI_STACK_API_BASE_URL.");
}

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this release builder through npm.");

const build = spawnSync(process.execPath, [npmCli, "run", "build"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NEXT_PUBLIC_AI_STACK_API_BASE_URL: publicApiOrigin,
  },
  stdio: "inherit",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

await import("./build-firebase.mjs");
