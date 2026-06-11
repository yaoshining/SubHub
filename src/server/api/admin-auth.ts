import type { NextRequest } from "next/server";

import {
  adminSessionCookieName,
  requireActiveAdminSession,
  type AdminSessionWithUser,
} from "@/lib/auth/session";
import type { StorageDatabase } from "@/server/storage/client";
import { assertProductionRuntimeReady } from "@/server/services/runtime-readiness-service";

export type AdminApiAuthOptions = {
  request: NextRequest | Request;
  db?: StorageDatabase;
  requireHighRiskClearance?: boolean;
  touchLastSeen?: boolean;
};

const readCookieFromHeader = (request: Request, name: string) => {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

export async function requireAdminApiSession({
  request,
  db,
  requireHighRiskClearance = false,
  touchLastSeen = true,
}: AdminApiAuthOptions): Promise<AdminSessionWithUser> {
  await assertProductionRuntimeReady({ db });

  const token =
    "cookies" in request && typeof request.cookies.get === "function"
      ? request.cookies.get(adminSessionCookieName)?.value
      : readCookieFromHeader(request, adminSessionCookieName);

  return requireActiveAdminSession(token, {
    db,
    touchLastSeen,
    requireHighRiskClearance,
  });
}
