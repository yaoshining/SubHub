import { NextResponse, type NextRequest } from "next/server";

import { adminSessionCookieName } from "@/lib/auth/session";
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAdminSessionCookie = Boolean(
    request.cookies.get(adminSessionCookieName)?.value,
  );

  if (pathname.startsWith("/api/admin/") && !hasAdminSessionCookie) {
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
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/providers/:path*",
    "/api-keys/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/api/admin/:path*",
  ],
};
