import type { ProviderDefinition } from "../../core/types.ts";

import { describe, expect, it } from "vitest";
import { createCatalogStore } from "../../catalog-store.ts";
import { prepareBundledCatalog } from "./bundled-catalog.ts";

const provider: ProviderDefinition = {
  service: "example",
  displayName: "Example",
  categories: ["Developer Tools"],
  authTypes: ["no_auth"],
  auth: [{ type: "no_auth" }],
  actions: [
    {
      id: "example.ping",
      service: "example",
      name: "ping",
      operationType: "read",
      description: "Ping",
      requiredScopes: [],
      providerPermissions: [],
      inputSchema: { type: "object" },
      outputSchema: {},
    },
  ],
};

describe("bundled Cloudflare catalog", () => {
  it("prepares both list locales without asset reads and loads schemas only on explicit detail requests", async () => {
    const metadata = [
      {
        ...provider,
        actions: provider.actions.map(({ inputSchema: _input, outputSchema: _output, ...action }) => action),
      },
    ];
    const options = { executableActionIds: ["example.ping"] };
    const bind = prepareBundledCatalog(metadata, options);
    const reads: string[] = [];
    const catalog = bind({
      fetch: async (request) => {
        reads.push(new URL(request.url).pathname);
        return Response.json(provider);
      },
    });
    const eager = createCatalogStore([provider], options);
    for (const locale of ["en", "zh-CN"] as const) {
      expect(catalog.getProviderDisplay(locale)).toEqual(eager.getProviderDisplay(locale));
    }
    expect(reads).toEqual([]);
    expect(await catalog.getAction("missing.ping")).toBeUndefined();
    expect(await catalog.getAction("example.ping")).toEqual(await eager.getAction("example.ping"));
    await catalog.getAction("example.ping");
    expect(reads).toEqual(["/catalog/providers/example.json"]);
  });

  it("retries failed asset reads instead of caching a rejected promise", async () => {
    let attempts = 0;
    const catalog = prepareBundledCatalog(
      [provider],
      {},
    )({
      fetch: async () => {
        if (++attempts === 1) return new Response("unavailable", { status: 503 });
        return Response.json(provider);
      },
    });
    await expect(catalog.getAction("example.ping")).rejects.toThrow("returned 503");
    expect((await catalog.getAction("example.ping"))?.inputSchema).toEqual({ type: "object" });
    expect(attempts).toBe(2);
  });
});
