import { ProviderDetailClient } from "@/app/(admin)/providers/[providerId]/provider-detail-client";

type ProviderDetailPageProps = {
  params: Promise<{ providerId: string }> | { providerId: string };
  searchParams?: Promise<{ created?: string }> | { created?: string };
};

export default async function ProviderDetailPage({
  params,
  searchParams,
}: ProviderDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <ProviderDetailClient
      providerId={resolvedParams.providerId}
      postCreate={resolvedSearchParams.created === "1"}
    />
  );
}
