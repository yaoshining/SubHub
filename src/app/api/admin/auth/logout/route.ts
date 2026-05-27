import type { NextRequest } from "next/server";

import { adminSessionCookieName } from "@/lib/auth/constants";
import { requireAdminApiSession } from "@/server/api/admin-auth";
import {
  apiErrorFromUnknown,
  apiNoContent,
} from "@/server/api/response";
import { logoutAdmin } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession({ request, touchLastSeen: false });
    const token = request.cookies.get(adminSessionCookieName)?.value;

    if (token) {
      await logoutAdmin(token);
    }

    const response = apiNoContent();
    response.cookies.set(adminSessionCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
