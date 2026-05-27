import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import {
  getProviderDetail,
  updateProvider,
} from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(0).optional(),
  concurrencyLimit: z.number().int().min(1).optional(),
  rotationEnabled: z.boolean().optional(),
  cooldownSeconds: z.number().int().min(0).optional(),
  fallbackProviderId: z.string().nullable().optional(),
});

type ProviderRouteContext = {
  params: Promise<{ providerId: string }> | { providerId: string };
};

const resolveParams = async (context: ProviderRouteContext) =>
  await context.params;

export async function GET(request: NextRequest, context: ProviderRouteContext) {
  try {
    await requireAdminApiSession({ request });
    const { providerId } = await resolveParams(context);

    return apiSuccess(await getProviderDetail(providerId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: ProviderRouteContext,
) {
  try {
    await requireAdminApiSession({ request });
    const { providerId } = await resolveParams(context);
    const input = updateProviderSchema.parse(await request.json());

    return apiSuccess(await updateProvider(providerId, input));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
