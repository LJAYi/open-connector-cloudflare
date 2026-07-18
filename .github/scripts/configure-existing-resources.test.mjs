import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { configureExistingResources } from "./configure-existing-resources.mjs";

const wranglerPath = new URL("../../wrangler.jsonc", import.meta.url);
const source = await readFile(wranglerPath, "utf8");
const databaseId = "12345678-1234-4abc-8def-1234567890ab";
const bucketName = "existing-open-connector-files";

test("leaves automatic provisioning unchanged when no existing resources are configured", () => {
  assert.equal(configureExistingResources(source), source);
});

test("injects existing D1 and R2 resource identifiers", () => {
  const configured = configureExistingResources(source, databaseId, bucketName);

  assert.match(configured, new RegExp(`"database_id": "${databaseId}"`));
  assert.match(configured, new RegExp(`"bucket_name": "${bucketName}"`));
  assert.equal(configureExistingResources(configured, databaseId, bucketName), configured);
});

test("requires both resource identifiers", () => {
  assert.throws(
    () => configureExistingResources(source, databaseId),
    /OPEN_CONNECT_D1_DATABASE_ID and OPEN_CONNECT_R2_BUCKET_NAME must be set together/,
  );
});

test("validates resource identifiers", () => {
  assert.throws(() => configureExistingResources(source, "not-a-uuid", bucketName), /must be a D1 database UUID/);
  assert.throws(
    () => configureExistingResources(source, databaseId, "INVALID_BUCKET"),
    /must be a valid R2 bucket name/,
  );
});
