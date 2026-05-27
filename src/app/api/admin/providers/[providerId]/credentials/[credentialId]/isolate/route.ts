import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { isolateProviderCredential } from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

const isolateCredentialSchema = z.object({
  reason: z.string().min(1).default("管理员手动隔离异常凭据。"),
});

type CredentialActionContext = {
  params:
    | Promise<{ providerId: string; credentialId: string }>
    | { providerId: string; credentialId: string };
};

export async function POST(
  request: NextRequest,
  { params }: CredentialActionContext,
) {
  try {
    const session = await requireAdminApiSession({ request });
    const { providerId, credentialId } = await params;
    const input = isolateCredentialSchema.parse(
      await request.json().catch(() => ({})),
    );

    return apiSuccess(
      await isolateProviderCredential(providerId, credentialId, input.reason, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
