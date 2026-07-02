import { StorageDatabase } from "@/server/storage";
import { ProviderRepository } from "@/server/providers/provider-repository";
import type { Provider } from "@/server/storage/schema";

export type EnabledCandidate = Provider;

export async function getEnabledCandidates(
  db: StorageDatabase,
  now?: Date,
): Promise<EnabledCandidate[]> {
  const repository = new ProviderRepository(db);
  const allProviders = await repository.listProviders(undefined, now);

  return allProviders.filter((p) => {
    const qualifiesByStatus = p.status === "enabled" || p.status === "degraded";
    if (!qualifiesByStatus) return false;
    const credentialRelevant = (p.type as string) === "opensubtitles";
    const hasCredentials =
      !credentialRelevant || (p.availableCredentialCount ?? 0) > 0;
    return hasCredentials;
  });
}
