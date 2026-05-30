import { z } from "zod";

import { adminSessionCookieName } from "@/lib/auth/constants";
import { apiErrorFromUnknown, apiSuccess } from "@/server/api/response";
import { loginAdmin } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

const loginRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  deviceLabel: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = loginRequestSchema.parse(await request.json());
    const result = await loginAdmin(payload);
    const response = apiSuccess({ admin: result.admin });

    response.cookies.set(adminSessionCookieName, result.session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(result.session.expiresAt),
    });

    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
