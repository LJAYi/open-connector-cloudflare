import { providers } from "../../providers/catalog.cloudflare.generated.ts";
import { executorModules } from "../../providers/registry.cloudflare.generated.ts";
import { prepareBundledCatalog } from "./bundled-catalog.ts";

export const bindStartupCatalog: ReturnType<typeof prepareBundledCatalog> = prepareBundledCatalog(providers, {
  executableServices: Object.keys(executorModules),
});
