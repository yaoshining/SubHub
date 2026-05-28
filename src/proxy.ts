import { NextResponse, type NextRequest } from "next/server";

import {
  adminRequestPathHeader,
  adminSessionCookieName,
} from "@/lib/auth/constants";
import { AppError, toApiErrorResponse } from "@/lib/errors";

const protectedAdminPages = [
  "/dashboard",
  "/providers",
  "/api-keys",
  "/users",
  "/settings",
];

const isProtectedAdminPage = (pathname: string) =>
  protectedAdminPages.some(
    (protectedPath) =>
      pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );

const publicAdminApiPaths = [
  "/api/admin/bootstrap/status",
  "/api/admin/bootstrap",
  "/api/admin/auth/login",
];

const isPublicAdminApiPath = (pathname: string) =>
  publicAdminApiPaths.includes(pathname);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const protectedTarget = `${pathname}${search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(adminRequestPathHeader, protectedTarget);
  const hasAdminSessionCookie = Boolean(
    request.cookies.get(adminSessionCookieName)?.value,
  );

  if (
    (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) &&
    !isPublicAdminApiPath(pathname) &&
    !hasAdminSessionCookie
  ) {
    return NextResponse.json(
      toApiErrorResponse(
        new AppError(
          "AUTHENTICATION_REQUIRED",
          "需要管理员会话后才能访问管理端 API。",
          "admin_session",
        ),
      ),
      { status: 401 },
    );
  }

  if (isProtectedAdminPage(pathname) && !hasAdminSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", protectedTarget);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/providers/:path*",
    "/api-keys/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/api/admin",
    "/api/admin/:path*",
  ],
};
