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

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const filter: Partial<{ type: string; status: string }> = {};
    if (type === "opensubtitles" || type === "xunlei") {
      filter.type = type;
    }
    if (status) {
      filter.status = status;
    }

    const providerFilter: ProviderFilter = {};
    if (filter.type === "opensubtitles" || filter.type === "xunlei") {
      providerFilter.type = filter.type;
    }
    if (
      filter.status === "enabled" ||
      filter.status === "disabled" ||
      filter.status === "needs_config" ||
      filter.status === "degraded"
    ) {
      providerFilter.status = filter.status;
    }

    return apiSuccess(
      await listProviders(
        Object.keys(providerFilter).length > 0 ? providerFilter : undefined,
      ),
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
