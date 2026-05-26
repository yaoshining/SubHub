export const appErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_FAILED",
  "SERVICE_NOT_READY",
  "CALLER_KEY_INVALID",
  "CALLER_KEY_SUSPENDED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_CREDENTIAL_EXHAUSTED",
  "NO_RESULTS",
  "SUBTITLE_NOT_FOUND",
  "UPSTREAM_FAILED",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly target?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ApiErrorResponse = {
  error: {
    code: AppErrorCode;
    message: string;
    target?: string;
  };
};

export function toApiErrorResponse(error: AppError): ApiErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.target ? { target: error.target } : {}),
    },
  };
}
