import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { createAdminInvitation } from "@/server/services/admin-invitation-service";

export const dynamic = "force-dynamic";

const createInvitationSchema = z.object({
  identifier: z.string().min(1),
  rolePreset: z.enum(["admin", "operator"]),
  accessPreset: z.literal("admin_console"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApiSession({
      request,
      requireHighRiskClearance: true,
    });
    const input = createInvitationSchema.parse(await request.json());

    return apiSuccess(
      await createAdminInvitation(input, {
        actorAdminUserId: session.adminUser.id,
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
