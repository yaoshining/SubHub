import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { searchSubtitles } from "@/server/subtitles/subtitle-gateway";

export const dynamic = "force-dynamic";

const searchParamsSchema = z.object({
  title: z.string().min(1),
  year: z.coerce.number().int().min(1800).max(3000).optional(),
  season: z.coerce.number().int().min(0).optional(),
  episode: z.coerce.number().int().min(0).optional(),
  language: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const input = searchParamsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    return apiSuccess(await searchSubtitles(request, input));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
