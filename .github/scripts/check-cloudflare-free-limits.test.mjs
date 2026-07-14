import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkCloudflareFreeLimits,
  parseWranglerAssetCount,
  parseWranglerGzipBytes,
} from "./check-cloudflare-free-limits.mjs";

test("parses Wrangler gzip sizes", () => {
  assert.equal(parseWranglerGzipBytes("Total Upload: 10 KiB / gzip: 2.5 KiB"), 2560);
  assert.equal(parseWranglerGzipBytes("gzip: 1.25 MiB"), 1_310_720);
  assert.throws(() => parseWranglerGzipBytes("dry run complete"), /Could not find Wrangler/);
});

test("parses Wrangler asset counts", () => {
  assert.equal(parseWranglerAssetCount("Read 10 files from the assets directory /tmp/dist"), 10);
  assert.equal(parseWranglerAssetCount("Read 18,001 files from the assets directory /tmp/dist"), 18_001);
  assert.equal(parseWranglerAssetCount("No assets binding configured"), undefined);
});

test("reports Worker, asset size, and asset count violations", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cloudflare-free-limits-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  const assetsDirectory = path.join(root, "assets");
  const nestedDirectory = path.join(assetsDirectory, "nested");
  const wranglerOutputPath = path.join(root, "wrangler.log");
  await mkdir(nestedDirectory, { recursive: true });
  await writeFile(wranglerOutputPath, "Total Upload: 20 KiB / gzip: 5 KiB\n");
  await writeFile(path.join(assetsDirectory, "small.txt"), "1234");
  await writeFile(path.join(nestedDirectory, "large.txt"), "123456789");

  const result = await checkCloudflareFreeLimits({
    wranglerOutputPath,
    assetsDirectory,
    limits: { workerGzipBytes: 4096, assetBytes: 8, assetCount: 1 },
  });

  assert.equal(result.workerGzipBytes, 5120);
  assert.deepEqual(result.largestAsset, { relativePath: "nested/large.txt", sizeBytes: 9 });
  assert.equal(result.violations.length, 3);
});

test("passes when every measurement has headroom", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cloudflare-free-limits-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  const assetsDirectory = path.join(root, "assets");
  const wranglerOutputPath = path.join(root, "wrangler.log");
  await mkdir(assetsDirectory);
  await writeFile(wranglerOutputPath, "Total Upload: 4 KiB / gzip: 1 KiB\n");
  await writeFile(path.join(assetsDirectory, "asset.txt"), "1234");

  const result = await checkCloudflareFreeLimits({
    wranglerOutputPath,
    assetsDirectory,
    limits: { workerGzipBytes: 2048, assetBytes: 8, assetCount: 2 },
  });

  assert.deepEqual(result.violations, []);
});

test("ignores symbolic links when collecting assets", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cloudflare-free-limits-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  const assetsDirectory = path.join(root, "assets");
  const wranglerOutputPath = path.join(root, "wrangler.log");
  await mkdir(assetsDirectory);
  await writeFile(wranglerOutputPath, "Total Upload: 4 KiB / gzip: 1 KiB\n");
  await writeFile(path.join(assetsDirectory, "asset.txt"), "1234");
  await symlink("asset.txt", path.join(assetsDirectory, "linked-asset.txt"));
  await symlink("missing.txt", path.join(assetsDirectory, "dangling-asset.txt"));

  const result = await checkCloudflareFreeLimits({
    wranglerOutputPath,
    assetsDirectory,
    limits: { workerGzipBytes: 2048, assetBytes: 8, assetCount: 2 },
  });

  assert.deepEqual(result.assets, [{ relativePath: "asset.txt", sizeBytes: 4 }]);
  assert.deepEqual(result.violations, []);
});
