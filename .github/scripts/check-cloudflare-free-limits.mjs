import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MEBIBYTE = 1024 * 1024;
const ANSI_ESCAPE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export const DEFAULT_LIMITS = Object.freeze({
  workerGzipBytes: Math.floor(2.7 * MEBIBYTE),
  assetBytes: 23 * MEBIBYTE,
  assetCount: 18_000,
});

export async function checkCloudflareFreeLimits({ wranglerOutputPath, assetsDirectory, limits = DEFAULT_LIMITS }) {
  const wranglerOutput = await readFile(wranglerOutputPath, "utf8");
  const workerGzipBytes = parseWranglerGzipBytes(wranglerOutput);
  const assets = await collectAssets(assetsDirectory);
  const assetCount = Math.max(parseWranglerAssetCount(wranglerOutput) ?? 0, assets.length);
  const largestAsset = assets.reduce((largest, asset) => (asset.sizeBytes > largest.sizeBytes ? asset : largest), {
    relativePath: "(none)",
    sizeBytes: 0,
  });
  const violations = [];

  if (workerGzipBytes > limits.workerGzipBytes) {
    violations.push(
      `Worker gzip size ${formatBytes(workerGzipBytes)} exceeds the ${formatBytes(limits.workerGzipBytes)} guard`,
    );
  }
  if (largestAsset.sizeBytes > limits.assetBytes) {
    violations.push(
      `Static asset ${largestAsset.relativePath} is ${formatBytes(largestAsset.sizeBytes)}, exceeding the ${formatBytes(limits.assetBytes)} guard`,
    );
  }
  if (assetCount > limits.assetCount) {
    violations.push(`Static asset count ${assetCount} exceeds the ${limits.assetCount.toLocaleString("en-US")} guard`);
  }

  return { workerGzipBytes, assets, assetCount, largestAsset, violations };
}

export function parseWranglerGzipBytes(output) {
  const plainOutput = output.replace(ANSI_ESCAPE_PATTERN, "");
  const match = plainOutput.match(/gzip:\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KB|KiB|MB|MiB)\b/i);
  if (!match) {
    throw new Error("Could not find Wrangler's gzip upload size in the dry-run output.");
  }

  return Math.round(Number(match[1]) * unitMultiplier(match[2]));
}

export function parseWranglerAssetCount(output) {
  const plainOutput = output.replace(ANSI_ESCAPE_PATTERN, "");
  const match = plainOutput.match(/Read\s+([0-9][0-9,]*)\s+files?\s+from the assets directory/i);
  return match ? Number(match[1].replaceAll(",", "")) : undefined;
}

async function collectAssets(rootDirectory) {
  const assets = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }
      const fileStat = await stat(absolutePath);
      assets.push({
        relativePath: path.relative(rootDirectory, absolutePath).split(path.sep).join("/"),
        sizeBytes: fileStat.size,
      });
    }
  }

  await visit(rootDirectory);
  return assets.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function unitMultiplier(unit) {
  switch (unit.toLowerCase()) {
    case "b":
      return 1;
    case "kb":
      return 1000;
    case "kib":
      return 1024;
    case "mb":
      return 1000 * 1000;
    case "mib":
      return MEBIBYTE;
    default:
      throw new Error(`Unsupported size unit: ${unit}`);
  }
}

function formatBytes(bytes) {
  return `${(bytes / MEBIBYTE).toFixed(2)} MiB`;
}

function annotationValue(value) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

async function main() {
  const [wranglerOutputPath, assetsDirectory] = process.argv.slice(2);
  if (!wranglerOutputPath || !assetsDirectory) {
    throw new Error(
      "Usage: node .github/scripts/check-cloudflare-free-limits.mjs <wrangler-output-file> <assets-directory>",
    );
  }

  const result = await checkCloudflareFreeLimits({ wranglerOutputPath, assetsDirectory });
  console.log("Cloudflare Free plan headroom check");
  console.log(`  Worker gzip: ${formatBytes(result.workerGzipBytes)} / ${formatBytes(DEFAULT_LIMITS.workerGzipBytes)}`);
  console.log(
    `  Static assets: ${result.assetCount.toLocaleString("en-US")} / ${DEFAULT_LIMITS.assetCount.toLocaleString("en-US")}`,
  );
  console.log(
    `  Largest asset: ${result.largestAsset.relativePath} (${formatBytes(result.largestAsset.sizeBytes)} / ${formatBytes(DEFAULT_LIMITS.assetBytes)})`,
  );

  if (result.violations.length === 0) {
    console.log("Cloudflare Free plan headroom checks passed.");
    return;
  }

  for (const violation of result.violations) {
    console.error(violation);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`::error title=Cloudflare Free plan limit::${annotationValue(violation)}`);
    }
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
