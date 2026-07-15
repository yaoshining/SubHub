import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { listSubtitleValidatorProviders } from "@/server/subtitles/admin-subtitle-validator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });
    return apiSuccess(await listSubtitleValidatorProviders());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
