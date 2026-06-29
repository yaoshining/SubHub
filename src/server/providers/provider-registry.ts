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
  xunlei: () => new XunleiAdapter(),
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
