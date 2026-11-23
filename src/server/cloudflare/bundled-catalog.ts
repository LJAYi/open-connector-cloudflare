import type { CatalogProviderMetadata, CatalogStore, ExecutableActionOptions } from "../../catalog-store.ts";
import type { ProviderDefinition } from "../../core/types.ts";
import type { AssetsBinding } from "./cloudflare-bindings.ts";

import { AsyncLocalStorage } from "node:async_hooks";
import { createCatalogFromMetadata, resolveExecutableActionIds } from "../../catalog-store.ts";
import { readJsonAsset } from "./catalog-assets.ts";

const requestReads = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/** Coalesce schema reads only within one request, never across request lifetimes. */
export function withCatalogAssetScope<T>(run: () => Promise<T>): Promise<T> {
  return requestReads.run(new Map(), run);
}

/** Prepare immutable list data during isolate startup, not within a Free-plan request's CPU budget. */
export function prepareBundledCatalog(
  providers: CatalogProviderMetadata[],
  options: ExecutableActionOptions,
): (assets: AssetsBinding) => CatalogStore {
  const prepared = createCatalogFromMetadata(
    providers,
    async () => {
      throw new Error("Action schemas require an assets binding");
    },
    { executableActionIds: resolveExecutableActionIds(providers, options) },
  );
  prepared.getProviderDisplay("zh-CN");

  return (assets) => {
    // Cache settled data only: an interrupted request must not strand other requests on its promise.
    const cache = new Map<string, ProviderDefinition>();
    return {
      ...prepared,
      async getAction(id) {
        const summary = prepared.actionsById.get(id);
        if (!summary) return undefined;
        const service = summary.service;
        let provider = cache.get(service);
        if (!provider) {
          const reads = requestReads.getStore();
          let pending = reads?.get(service);
          if (!pending) {
            pending = readJsonAsset(assets, `/catalog/providers/${encodeURIComponent(service)}.json`);
            reads?.set(service, pending);
          }
          provider = (await pending) as ProviderDefinition;
          if (provider.service !== service || !Array.isArray(provider.actions)) {
            throw new Error(`Invalid catalog provider asset: ${service}`);
          }
        }
        cache.delete(service);
        cache.set(service, provider);
        if (cache.size > 64) cache.delete(cache.keys().next().value!);
        const action = provider.actions.find((action) => action.id === id);
        if (!action) throw new Error(`Catalog action ${id} is missing from ${service}`);
        return { ...action, ...summary };
      },
    };
  };
}
