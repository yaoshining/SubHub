import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginClient } from "@/app/login/login-client";
import {
  adminSessionCookieName,
  requireActiveAdminSession,
} from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    auth?: string | string[];
    next?: string | string[];
  }>;
};

const getSafeReturnTo = (value: string | string[] | undefined) => {
  const target = Array.isArray(value) ? value[0] : value;

  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    /[\r\n]/.test(target)
  ) {
    return "/dashboard";
  }

  if (target.startsWith("/login")) {
    return "/dashboard";
  }

  return target;
};

const getSessionNotice = (value: string | string[] | undefined) => {
  const authReason = Array.isArray(value) ? value[0] : value;

  if (authReason === "session-expired") {
    return "管理员会话已失效，请重新登录。";
  }

  return null;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = getSafeReturnTo(params.next);
  const sessionNotice = getSessionNotice(params.auth);
  const cookieStore = await cookies();
  let hasActiveSession = false;

  try {
    await requireActiveAdminSession(
      cookieStore.get(adminSessionCookieName)?.value,
      { touchLastSeen: true },
    );
    hasActiveSession = true;
  } catch {
    hasActiveSession = false;
  }

  if (hasActiveSession) {
    redirect(returnTo);
  }

  return <LoginClient returnTo={returnTo} sessionNotice={sessionNotice} />;
}
