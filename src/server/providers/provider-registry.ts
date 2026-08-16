import { readEnv } from "@/lib/env";
import type {
  SubtitleProviderAdapter,
  SubtitleProviderKey,
} from "@/server/providers/provider-adapter";
import { OpenSubtitlesAdapter } from "@/server/providers/opensubtitles-adapter";
import { XunleiAdapter } from "@/server/providers/xunlei-adapter";

const adapterFactories: Record<
  SubtitleProviderKey,
  () => SubtitleProviderAdapter
> = {
  opensubtitles: () => new OpenSubtitlesAdapter(),
  xunlei: () => {
    const env = readEnv();
    return new XunleiAdapter({
      timeoutMs: env.XUNLEI_API_TIMEOUT_MS,
      maxRetries: env.XUNLEI_API_MAX_RETRIES,
      retryBackoffMs: env.XUNLEI_API_RETRY_BACKOFF_MS,
    });
  },
};

const adapterCache = new Map<SubtitleProviderKey, SubtitleProviderAdapter>();

export function getAdapter(key: SubtitleProviderKey): SubtitleProviderAdapter {
  let adapter = adapterCache.get(key);
  if (!adapter) {
    adapter = adapterFactories[key]();
    adapterCache.set(key, adapter);
  }
  return adapter;
}

export function listProviderKeys(): SubtitleProviderKey[] {
  return Object.keys(adapterFactories) as SubtitleProviderKey[];
}
