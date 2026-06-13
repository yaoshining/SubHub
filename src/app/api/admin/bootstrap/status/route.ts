import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { getRuntimeReadinessStatus } from "@/server/services/runtime-readiness-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiSuccess(await getRuntimeReadinessStatus());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
