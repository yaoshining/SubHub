import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiSession } from "@/server/api/admin-auth";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import {
  createCallerKey,
  listCallerKeys,
} from "@/server/services/caller-key-service";

export const dynamic = "force-dynamic";

const createCallerKeySchema = z.object({
  callerName: z.string().min(1),
  environment: z.enum(["production", "staging", "development"]),
  scope: z.literal("subtitles:read"),
  quotaPolicy: z.string().min(1).default("default"),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession({ request });

    return apiSuccess(await listCallerKeys());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApiSession({ request });
    const input = createCallerKeySchema.parse(await request.json());

    return apiSuccess(
      await createCallerKey(input, {
        actorAdminUserId: session.adminUser.id,
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
