import { z } from "zod";

import { AppError } from "@/lib/errors";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { createInitialAdmin } from "@/server/services/bootstrap-service";
import { getRuntimeReadinessStatus } from "@/server/services/runtime-readiness-service";

export const dynamic = "force-dynamic";

const bootstrapRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const runtimeStatus = await getRuntimeReadinessStatus().catch(
      () => undefined,
    );
    if (runtimeStatus && !runtimeStatus.schemaReady) {
      throw new AppError(
        "SERVICE_NOT_READY",
        `schema 未就绪，无法执行首个管理员初始化。${runtimeStatus.missingTables.length > 0 ? ` 缺少表：${runtimeStatus.missingTables.join(", ")}。` : ""}`,
        "schema",
      );
    }

    const payload = bootstrapRequestSchema.parse(await request.json());
    const result = await createInitialAdmin(payload);

    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
