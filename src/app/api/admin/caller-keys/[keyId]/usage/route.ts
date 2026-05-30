import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { getCallerKeyUsage } from "@/server/services/caller-key-service";

export const dynamic = "force-dynamic";

type CallerKeyRouteContext = {
  params: Promise<{ keyId: string }> | { keyId: string };
};

const resolveParams = async (context: CallerKeyRouteContext) =>
  await context.params;

export async function GET(
  request: NextRequest,
  context: CallerKeyRouteContext,
) {
  try {
    await requireAdminApiSession({ request });
    const { keyId } = await resolveParams(context);

    return apiSuccess(await getCallerKeyUsage(keyId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
