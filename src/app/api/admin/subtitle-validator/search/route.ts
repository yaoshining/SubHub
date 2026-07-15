import type { NextRequest } from "next/server";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { searchSubtitleValidator } from "@/server/subtitles/admin-subtitle-validator";
import { subtitleValidatorSearchRequestSchema } from "@/server/subtitles/admin-subtitle-validator-schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });
    const body = await request.json();
    const input = subtitleValidatorSearchRequestSchema.parse(body);
    return apiSuccess(await searchSubtitleValidator(input));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
