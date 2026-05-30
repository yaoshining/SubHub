import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorFromUnknown } from "@/server/api/response";
import {
  buildSubtitleDownloadHeaders,
  downloadSubtitle,
} from "@/server/subtitles/subtitle-download";

export const dynamic = "force-dynamic";

const downloadParamsSchema = z.object({
  subtitleId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { subtitleId } = downloadParamsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await downloadSubtitle(request, subtitleId);

    return new Response(result.content, {
      status: 200,
      headers: buildSubtitleDownloadHeaders(result),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
