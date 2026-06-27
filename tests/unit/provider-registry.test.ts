import { describe, expect, it } from "vitest";

import {
  getAdapter,
  listProviderKeys,
} from "@/server/providers/provider-registry";
import type { SubtitleProviderKey } from "@/server/providers/provider-adapter";

describe("provider-registry", () => {
  it("listProviderKeys 返回 opensubtitles 和 xunlei", () => {
    const keys = listProviderKeys();
    expect(keys).toContain("opensubtitles");
    expect(keys).toContain("xunlei");
    expect(keys).toHaveLength(2);
  });

  it("getAdapter(opensubtitles) 返回 key 为 opensubtitles 的 adapter", () => {
    const adapter = getAdapter("opensubtitles");
    expect(adapter.key).toBe("opensubtitles");
  });

  it("getAdapter(xunlei) 返回 key 为 xunlei 的 adapter", () => {
    const adapter = getAdapter("xunlei");
    expect(adapter.key).toBe("xunlei");
  });

  it("每个 adapter 都有 search 方法", () => {
    const keys: SubtitleProviderKey[] = ["opensubtitles", "xunlei"];
    for (const key of keys) {
      const adapter = getAdapter(key);
      expect(typeof adapter.search).toBe("function");
    }
  });
});
