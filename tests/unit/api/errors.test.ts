import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  apiError,
  apiErrorFromUnknown,
  apiSuccess,
  getHttpStatusForError,
  validationErrorFromZod,
} from "@/server/api/response";

const readJson = async <T>(response: Response) => (await response.json()) as T;

describe("统一 API 响应错误结构", () => {
  it("映射认证、授权、Caller Key 与服务错误状态码", () => {
    expect(getHttpStatusForError("AUTHENTICATION_REQUIRED")).toBe(401);
    expect(getHttpStatusForError("FORBIDDEN")).toBe(403);
    expect(getHttpStatusForError("CALLER_KEY_INVALID")).toBe(401);
    expect(getHttpStatusForError("CALLER_KEY_SUSPENDED")).toBe(403);
    expect(getHttpStatusForError("SERVICE_NOT_READY")).toBe(503);
    expect(getHttpStatusForError("UPSTREAM_FAILED")).toBe(502);
  });

  it("返回稳定的错误响应结构", async () => {
    const response = apiError(
      new AppError("AUTHENTICATION_REQUIRED", "需要登录。", "admin_session"),
    );
    const payload = await readJson<{
      error: { code: string; message: string; target?: string };
    }>(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "需要登录。",
        target: "admin_session",
      },
    });
  });

  it("将字段校验错误映射为 VALIDATION_FAILED", async () => {
    const schema = z.object({ callerName: z.string().min(1) });
    const parseResult = schema.safeParse({ callerName: "" });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const error = validationErrorFromZod(parseResult.error);
      const response = apiError(error);
      const payload = await readJson<{
        error: { code: string; message: string; target?: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe("VALIDATION_FAILED");
      expect(payload.error.target).toBe("callerName");
    }
  });

  it("统一成功响应使用 data 包裹，未知错误不会泄露内部细节", async () => {
    const success = await readJson<{ data: { ok: boolean } }>(
      apiSuccess({ ok: true }),
    );
    const failure = await readJson<{
      error: { code: string; message: string };
    }>(apiErrorFromUnknown(new Error("database password leaked")));

    expect(success).toEqual({ data: { ok: true } });
    expect(failure.error.code).toBe("UPSTREAM_FAILED");
    expect(failure.error.message).toBe("请求处理失败。");
  });
});
