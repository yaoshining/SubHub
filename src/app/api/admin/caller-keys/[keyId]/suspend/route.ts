import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { suspendCallerKey } from "@/server/services/caller-key-service";

export const dynamic = "force-dynamic";

type CallerKeyRouteContext = {
  params: Promise<{ keyId: string }> | { keyId: string };
};

const resolveParams = async (context: CallerKeyRouteContext) =>
  await context.params;

export async function POST(
  request: NextRequest,
  context: CallerKeyRouteContext,
) {
  try {
    const session = await requireAdminApiSession({
      request,
      requireHighRiskClearance: true,
    });
    const { keyId } = await resolveParams(context);

    return apiSuccess(
      await suspendCallerKey(keyId, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
