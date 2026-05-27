import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { restoreProviderCredential } from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

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

    return apiSuccess(
      await restoreProviderCredential(providerId, credentialId, {
        actorAdminUserId: session.adminUser.id,
      }),
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
