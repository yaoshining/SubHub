import { z } from "zod";

import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { createInitialAdmin } from "@/server/services/bootstrap-service";

export const dynamic = "force-dynamic";

const bootstrapRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = bootstrapRequestSchema.parse(await request.json());
    const result = await createInitialAdmin(payload);

    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
