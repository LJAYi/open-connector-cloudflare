import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const allowedRepositories = new Set(["oomol-lab/open-connector", "LJAYi/open-connector"]);
const commitPattern = /^[0-9a-f]{40}$/;

export function configureCanary(source, repository, commit) {
  if (!allowedRepositories.has(repository)) {
    throw new Error(`Unsupported canary source repository: ${repository}`);
  }
  if (!commitPattern.test(commit)) {
    throw new Error("Canary source commit must be a full 40-character SHA");
  }

  const workerNameLines = source.match(/^\s*"name"\s*:\s*"open-connector",\s*$/gm) ?? [];
  const databaseNameLines = source.match(/^\s*"database_name"\s*:\s*"open-connector",\s*$/gm) ?? [];
  if (workerNameLines.length !== 1 || databaseNameLines.length !== 1) {
    throw new Error("Expected one open-connector Worker name and one D1 database name");
  }

  return {
    wranglerConfig: source
      .replace(/^(\s*)"name"\s*:\s*"open-connector",\s*$/m, '$1"name": "open-connector-canary",')
      .replace(/^(\s*)"database_name"\s*:\s*"open-connector",\s*$/m, '$1"database_name": "open-connector-canary",'),
    version: `canary:${repository}@${commit}\n`,
  };
}

async function main() {
  const repository = process.argv[2];
  const commit = process.argv[3];
  const wranglerPath = new URL("../../wrangler.jsonc", import.meta.url);
  const versionPath = new URL("../../.open-connector-version", import.meta.url);
  const source = await readFile(wranglerPath, "utf8");
  const configured = configureCanary(source, repository, commit);
  await Promise.all([writeFile(wranglerPath, configured.wranglerConfig), writeFile(versionPath, configured.version)]);
  console.log(`Configured canary deployment from ${repository}@${commit.slice(0, 12)}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
