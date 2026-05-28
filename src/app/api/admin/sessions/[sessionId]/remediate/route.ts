import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { remediateAdminSession } from "@/server/services/admin-session-service";

export const dynamic = "force-dynamic";

const remediateSessionSchema = z.object({
  action: z.enum(["revoke", "mark_resolved"]),
  reason: z.string().min(1),
});

type AdminSessionRouteContext = {
  params: Promise<{ sessionId: string }> | { sessionId: string };
};

export async function POST(
  request: NextRequest,
  { params }: AdminSessionRouteContext,
) {
  try {
    const session = await requireAdminApiSession({
      request,
      requireHighRiskClearance: true,
    });
    const { sessionId } = await params;
    const input = remediateSessionSchema.parse(await request.json());

    return apiSuccess(
      await remediateAdminSession(sessionId, input, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
