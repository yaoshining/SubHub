import { expect } from "vitest";

import type { ApiErrorResponse, AppErrorCode } from "@/lib/errors";

export function createJsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

export async function expectApiError(
  response: Response,
  code: AppErrorCode,
  expectedMessage?: string,
) {
  const payload = (await response.json()) as ApiErrorResponse;
  expect(payload.error.code).toBe(code);
  if (expectedMessage) {
    expect(payload.error.message).toBe(expectedMessage);
  } else {
    expect(payload.error.message).toEqual(expect.any(String));
  }
  return payload;
}
