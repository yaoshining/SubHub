import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { disableProvider } from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

type ProviderRouteContext = {
  params: Promise<{ providerId: string }> | { providerId: string };
};

export async function POST(
  request: NextRequest,
  { params }: ProviderRouteContext,
) {
  try {
    const session = await requireAdminApiSession({ request });
    const { providerId } = await params;

    return apiSuccess(
      await disableProvider(providerId, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
