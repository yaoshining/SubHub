import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import {
  createProvider,
  listProviders,
} from "@/server/services/provider-service";

export const dynamic = "force-dynamic";

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.literal("opensubtitles"),
  initialCredential: z
    .object({
      label: z.string().min(1),
      secret: z.string().min(1),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });

    return apiSuccess(await listProviders());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApiSession({ request });
    const input = createProviderSchema.parse(await request.json());
    const provider = await createProvider(input, {
      actorAdminUserId: session.adminUser.id,
    });

    return apiSuccess(provider, { status: 201 });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
