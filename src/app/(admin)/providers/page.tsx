import { Suspense } from "react";
import { ProvidersClient } from "@/app/(admin)/providers/providers-client";

function ProvidersSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="正在加载 Provider 列表"
    >
      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <div
            className="h-24 animate-pulse rounded-lg border bg-surface"
            key={item}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={<ProvidersSkeleton />}>
      <ProvidersClient />
    </Suspense>
  );
}
