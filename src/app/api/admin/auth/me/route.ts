import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { toCurrentAdmin } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminApiSession({ request });

    return apiSuccess({ admin: toCurrentAdmin(session) });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
