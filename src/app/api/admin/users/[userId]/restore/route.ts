import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { restoreAdminUser } from "@/server/services/admin-user-service";

export const dynamic = "force-dynamic";

type AdminUserRouteContext = {
  params: Promise<{ userId: string }> | { userId: string };
};

export async function POST(
  request: NextRequest,
  { params }: AdminUserRouteContext,
) {
  try {
    const session = await requireAdminApiSession({
      request,
      requireHighRiskClearance: true,
    });
    const { userId } = await params;

    return apiSuccess(
      await restoreAdminUser(userId, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
