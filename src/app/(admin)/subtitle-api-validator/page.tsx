import { Suspense } from "react";
import { SubtitleApiValidatorClient } from "@/app/(admin)/subtitle-api-validator/subtitle-api-validator-client";

function SubtitleApiValidatorSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="正在加载 Subtitle API Validator"
    >
      <div className="h-24 animate-pulse rounded-lg border bg-surface" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="h-[420px] animate-pulse rounded-lg border bg-surface" />
        <div className="h-[420px] animate-pulse rounded-lg border bg-surface" />
      </div>
    </div>
  );
}

export default function SubtitleApiValidatorPage() {
  return (
    <Suspense fallback={<SubtitleApiValidatorSkeleton />}>
      <SubtitleApiValidatorClient />
    </Suspense>
  );
}
