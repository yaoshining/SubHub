import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, type AppErrorCode, toApiErrorResponse } from "@/lib/errors";

const statusByErrorCode: Record<AppErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  SERVICE_NOT_READY: 503,
  CALLER_KEY_INVALID: 401,
  CALLER_KEY_SUSPENDED: 403,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_CREDENTIAL_EXHAUSTED: 503,
  NO_RESULTS: 404,
  SUBTITLE_NOT_FOUND: 404,
  UPSTREAM_FAILED: 502,
};

export type ApiSuccessResponse<T> = {
  data: T;
};

export function getHttpStatusForError(code: AppErrorCode) {
  return statusByErrorCode[code];
}

export function apiSuccess<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    { data },
    { status: init.status ?? 200, headers: init.headers },
  );
}

export function apiNoContent(init: ResponseInit = {}) {
  return new NextResponse(null, {
    status: init.status ?? 204,
    headers: init.headers,
  });
}

export function apiError(error: AppError, init: ResponseInit = {}) {
  return NextResponse.json(toApiErrorResponse(error), {
    status: init.status ?? getHttpStatusForError(error.code),
    headers: init.headers,
  });
}

export function validationErrorFromZod(error: ZodError) {
  const firstIssue = error.issues[0];
  const target = firstIssue?.path.map(String).join(".") || undefined;
  const message = firstIssue?.message ?? "请求字段校验失败。";

  return new AppError("VALIDATION_FAILED", message, target);
}

export function apiErrorFromUnknown(error: unknown) {
  if (error instanceof AppError) {
    return apiError(error);
  }

  if (error instanceof ZodError) {
    return apiError(validationErrorFromZod(error));
  }

  if (error instanceof SyntaxError) {
    return apiError(
      new AppError("VALIDATION_FAILED", "请求 JSON 格式无效。", "body"),
    );
  }

  return apiError(new AppError("UPSTREAM_FAILED", "请求处理失败。"));
}
