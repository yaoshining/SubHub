import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import {
  addProviderCredential,
  listProviderCredentials,
} from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

const createCredentialSchema = z.object({
  label: z.string().min(1),
  secret: z.string().min(1),
});

type CredentialRouteContext = {
  params: Promise<{ providerId: string }> | { providerId: string };
};

export async function GET(
  request: NextRequest,
  { params }: CredentialRouteContext,
) {
  try {
    await requireAdminApiSession({ request });
    const { providerId } = await params;

    return apiSuccess(await listProviderCredentials(providerId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: CredentialRouteContext,
) {
  try {
    await requireAdminApiSession({ request });
    const { providerId } = await params;
    const input = createCredentialSchema.parse(await request.json());

    return apiSuccess(await addProviderCredential(providerId, input), {
      status: 201,
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
