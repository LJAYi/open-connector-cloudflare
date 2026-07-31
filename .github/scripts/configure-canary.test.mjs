import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { configureCanary } from "./configure-canary.mjs";

const wranglerPath = new URL("../../wrangler.example.jsonc", import.meta.url);
const source = await readFile(wranglerPath, "utf8");
const commit = "0123456789abcdef0123456789abcdef01234567";

test("configures an isolated canary Worker and D1 database", () => {
  const configured = configureCanary(source, "oomol-lab/open-connector", commit);

  assert.match(configured.wranglerConfig, /"name": "open-connector-canary"/);
  assert.match(configured.wranglerConfig, /"database_name": "open-connector-canary"/);
  assert.equal(configured.version, `canary:oomol-lab/open-connector@${commit}\n`);
});

test("allows the owner's source fork", () => {
  assert.doesNotThrow(() => configureCanary(source, "LJAYi/open-connector", commit));
});

test("rejects untrusted repositories and ambiguous commits", () => {
  assert.throws(() => configureCanary(source, "someone/untrusted", commit), /Unsupported canary source repository/);
  assert.throws(() => configureCanary(source, "oomol-lab/open-connector", "main"), /must be a full 40-character SHA/);
});
