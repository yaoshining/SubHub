import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import type { ProviderFilter } from "@/server/providers/provider-repository";
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

const listProvidersQuerySchema = z.object({
  type: z.enum(["opensubtitles", "xunlei"]).optional(),
  status: z
    .enum(["enabled", "disabled", "needs_config", "degraded"])
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });

    const query = listProvidersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const filter: ProviderFilter = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    return apiSuccess(
      await listProviders(Object.keys(filter).length > 0 ? filter : undefined),
    );
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
