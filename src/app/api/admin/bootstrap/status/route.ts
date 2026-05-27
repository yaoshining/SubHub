import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { getBootstrapStatus } from "@/server/services/bootstrap-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiSuccess(await getBootstrapStatus());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
