import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { getSystemReadiness } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });

    return apiSuccess(await getSystemReadiness());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
