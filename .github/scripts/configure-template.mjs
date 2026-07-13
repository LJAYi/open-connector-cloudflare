import { readFile, writeFile } from "node:fs/promises";

const upstreamTag = process.argv[2];

if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(upstreamTag ?? "")) {
  throw new Error("Usage: node .github/scripts/configure-template.mjs <upstream-release-tag>");
}

const packagePath = new URL("../../package.json", import.meta.url);
const wranglerExamplePath = new URL("../../wrangler.example.jsonc", import.meta.url);
const wranglerPath = new URL("../../wrangler.jsonc", import.meta.url);
const versionPath = new URL("../../.open-connector-version", import.meta.url);

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

packageJson.scripts = {
  ...packageJson.scripts,
  deploy: "npm run deploy:cloudflare-template",
  "deploy:cloudflare-template":
    "npm run generate:catalog && npm run build:web && node scripts/copy-catalog-assets.ts && wrangler d1 migrations apply DB --remote && wrangler deploy --minify",
  "validate:cloudflare":
    "npm run generate:catalog && npm run build:web && node scripts/copy-catalog-assets.ts && wrangler deploy --dry-run --minify",
};

packageJson.cloudflare = {
  bindings: {
    DB: {
      description: "D1 stores connections, OAuth state, runtime tokens, and run logs.",
    },
    TRANSIT_FILES: {
      description: "R2 stores temporary files transferred through connector Actions.",
    },
    OOMOL_CONNECT_ADMIN_TOKEN: {
      description:
        "Generate a long random value for Web Console and admin API authentication. Save it in a password manager.",
    },
    OOMOL_CONNECT_ENCRYPTION_KEY: {
      description:
        "Generate a different long random value for credential encryption. Losing it makes encrypted D1 data unreadable.",
    },
  },
};

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const wranglerExample = await readFile(wranglerExamplePath, "utf8");
const databaseIdMatches = wranglerExample.match(/^\s*"database_id"\s*:.*$/gm) ?? [];
const bucketNameMatches = wranglerExample.match(/^\s*"bucket_name"\s*:.*$/gm) ?? [];

if (databaseIdMatches.length !== 1 || bucketNameMatches.length !== 1) {
  throw new Error(
    `Expected one D1 database_id and one R2 bucket_name in wrangler.example.jsonc; found ${databaseIdMatches.length} and ${bucketNameMatches.length}`,
  );
}

const wranglerConfig = wranglerExample
  .replace(/^\s*"database_id"\s*:.*\n/gm, "")
  .replace(/^\s*"bucket_name"\s*:.*\n/gm, "");

if (wranglerConfig.includes("<your-d1-database-id>") || wranglerConfig.includes("<your-bucket-name>")) {
  throw new Error("Account-specific Cloudflare resource placeholders remain in wrangler.jsonc");
}

await writeFile(wranglerPath, wranglerConfig);
await writeFile(versionPath, `${upstreamTag}\n`);
