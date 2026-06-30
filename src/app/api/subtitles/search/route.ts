import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { searchSubtitles } from "@/server/subtitles/subtitle-gateway";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

export const dynamic = "force-dynamic";

export const searchParamsSchema = z
  .object({
    title: z.string().trim().min(1),
    query: z.string().min(1).optional(),
    year: z.coerce.number().int().min(1800).max(3000).optional(),
    season: z.coerce.number().int().min(0).optional(),
    episode: z.coerce.number().int().min(0).optional(),
    language: z.string().min(1).optional(),
    imdb_id: z
      .string()
      .regex(/^tt\d+$/)
      .optional(),
    tmdb_id: z.coerce.number().int().min(1).optional(),
    type: z.enum(["movie", "episode"]).optional(),
  })
  .refine(
    (data) =>
      !(
        data.type === "movie" &&
        (data.season !== undefined || data.episode !== undefined)
      ),
    {
      message: "type=movie 与 season/episode 不能同时出现。",
      path: ["type"],
    },
  )
  .refine(
    (data) =>
      !(
        data.type === "episode" &&
        data.season === undefined &&
        data.episode === undefined &&
        data.imdb_id === undefined &&
        data.tmdb_id === undefined
      ),
    {
      message: "type=episode 需要提供 season/episode 或 imdb_id/tmdb_id 之一。",
      path: ["type"],
    },
  );

export async function GET(request: NextRequest) {
  try {
    const parsed = searchParamsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const input: SubtitleSearchInput = {
      title: parsed.title,
      query: parsed.query,
      year: parsed.year,
      season: parsed.season,
      episode: parsed.episode,
      language: parsed.language,
      imdbId: parsed.imdb_id,
      tmdbId: parsed.tmdb_id,
      type: parsed.type,
    };

    return apiSuccess(await searchSubtitles(request, input));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
