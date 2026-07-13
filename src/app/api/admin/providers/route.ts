import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import {
  apiError,
  apiErrorFromUnknown,
  apiSuccess,
} from "@/server/api/response";
import { AppError } from "@/lib/errors";
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
    const body = await request.json();

    // Xunlei 为预置单实例 provider，由 migration 接入；明确拒绝通过此接口创建，
    // 避免前端 UI 试探得到 zod 默认英文错误而无法理解限制原因。
    if (body?.type === "xunlei") {
      return apiError(
        new AppError(
          "VALIDATION_FAILED",
          "Xunlei 为预置 provider，单实例由 migration 接入；不支持通过此接口创建，如需恢复请走运维迁移。",
          "type",
        ),
      );
    }

    const input = createProviderSchema.parse(body);
    const provider = await createProvider(input, {
      actorAdminUserId: session.adminUser.id,
    });

    return apiSuccess(provider, { status: 201 });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
