import type { StorageDatabase } from "@/server/storage/client";
import { ProviderRepository } from "@/server/providers/provider-repository";
import type { ProviderWithCredentialSummary } from "@/server/providers/provider-repository";
import { hasCredentials } from "@/server/providers/credential-pool";

export type EnabledCandidate = ProviderWithCredentialSummary;

export async function getEnabledCandidates(
  db: StorageDatabase,
  now?: Date,
): Promise<EnabledCandidate[]> {
  const repository = new ProviderRepository(db);
  const allProviders = await repository.listProviders(undefined, now);

  return allProviders.filter((p) => {
    const qualifiesByStatus = p.status === "enabled" || p.status === "degraded";
    if (!qualifiesByStatus) return false;
    if (!hasCredentials(p.type)) return true;
    return (p.availableCredentialCount ?? 0) > 0;
  });
}
