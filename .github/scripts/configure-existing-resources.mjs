import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const databaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bucketNamePattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function configureExistingResources(source, databaseId, bucketName) {
  if (!databaseId && !bucketName) {
    return source;
  }
  if (!databaseId || !bucketName) {
    throw new Error("OPEN_CONNECT_D1_DATABASE_ID and OPEN_CONNECT_R2_BUCKET_NAME must be set together");
  }
  if (!databaseIdPattern.test(databaseId)) {
    throw new Error("OPEN_CONNECT_D1_DATABASE_ID must be a D1 database UUID");
  }
  if (!bucketNamePattern.test(bucketName)) {
    throw new Error("OPEN_CONNECT_R2_BUCKET_NAME must be a valid R2 bucket name");
  }

  let configured = source;
  const databaseIdLines = configured.match(/^\s*"database_id"\s*:.*$/gm) ?? [];
  const bucketNameLines = configured.match(/^\s*"bucket_name"\s*:.*$/gm) ?? [];

  if (databaseIdLines.length > 1 || bucketNameLines.length > 1) {
    throw new Error("Expected at most one D1 database_id and one R2 bucket_name");
  }

  if (databaseIdLines.length === 1) {
    configured = configured.replace(/^(\s*)"database_id"\s*:.*$/m, `$1"database_id": "${databaseId}",`);
  } else {
    const databaseNameLines = configured.match(/^\s*"database_name"\s*:\s*"open-connector",\s*$/gm) ?? [];
    if (databaseNameLines.length !== 1) {
      throw new Error('Expected one D1 database_name set to "open-connector"');
    }
    configured = configured.replace(
      /^(\s*)"database_name"\s*:\s*"open-connector",\s*$/m,
      `$&\n$1"database_id": "${databaseId}",`,
    );
  }

  if (bucketNameLines.length === 1) {
    configured = configured.replace(/^(\s*)"bucket_name"\s*:.*$/m, `$1"bucket_name": "${bucketName}",`);
  } else {
    const transitBindingLines = configured.match(/^\s*"binding"\s*:\s*"TRANSIT_FILES",\s*$/gm) ?? [];
    if (transitBindingLines.length !== 1) {
      throw new Error('Expected one active R2 binding named "TRANSIT_FILES"');
    }
    configured = configured.replace(
      /^(\s*)"binding"\s*:\s*"TRANSIT_FILES",\s*$/m,
      `$&\n$1"bucket_name": "${bucketName}",`,
    );
  }

  return configured;
}

async function main() {
  const databaseId = process.env.OPEN_CONNECT_D1_DATABASE_ID;
  const bucketName = process.env.OPEN_CONNECT_R2_BUCKET_NAME;

  if (!databaseId && !bucketName) {
    console.log("No existing Cloudflare resources configured; Wrangler automatic provisioning remains enabled.");
    return;
  }

  const wranglerPath = new URL("../../wrangler.jsonc", import.meta.url);
  const source = await readFile(wranglerPath, "utf8");
  const configured = configureExistingResources(source, databaseId, bucketName);
  await writeFile(wranglerPath, configured);
  console.log("Configured the existing D1 database and R2 bucket for this build.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
