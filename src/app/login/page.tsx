import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginClient } from "@/app/login/login-client";
import {
  adminSessionCookieName,
  requireActiveAdminSession,
} from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

const getSafeReturnTo = (value: string | string[] | undefined) => {
  const target = Array.isArray(value) ? value[0] : value;

  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/dashboard";
  }

  if (target.startsWith("/login")) {
    return "/dashboard";
  }

  return target;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = getSafeReturnTo(params.next);
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

  return <LoginClient returnTo={returnTo} />;
}
