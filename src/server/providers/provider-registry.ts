import type {
  SubtitleProviderAdapter,
  SubtitleProviderKey,
} from "@/server/providers/provider-adapter";
import { OpenSubtitlesAdapter } from "@/server/providers/opensubtitles-adapter";
import { XunleiAdapter } from "@/server/providers/xunlei-adapter";

const adapters: Record<SubtitleProviderKey, SubtitleProviderAdapter> = {
  opensubtitles: new OpenSubtitlesAdapter(),
  xunlei: new XunleiAdapter(),
};

export function getAdapter(key: SubtitleProviderKey): SubtitleProviderAdapter {
  return adapters[key];
}

export function listProviderKeys(): SubtitleProviderKey[] {
  return Object.keys(adapters) as SubtitleProviderKey[];
}
