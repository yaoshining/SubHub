import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as callerKeysRoute from "@/app/api/admin/caller-keys/route";
import * as rotateRoute from "@/app/api/admin/caller-keys/[keyId]/rotate/route";
import * as suspendRoute from "@/app/api/admin/caller-keys/[keyId]/suspend/route";
import * as usageRoute from "@/app/api/admin/caller-keys/[keyId]/usage/route";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import { expectApiError } from "../helpers/api";

let tempDir: string;

const jsonRequest = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const nextRequest = (url: string, cookie?: string, method = "GET") =>
  new NextRequest(url, {
    method,
    headers: cookie ? { cookie } : undefined,
  });

const readJson = async <T>(response: Response) => (await response.json()) as T;

const createAdminSessionCookie = async () => {
  await bootstrapRoute.POST(
    jsonRequest("http://localhost/api/admin/bootstrap", {
      identifier: "admin@example.com",
      displayName: "Admin",
      password: "CorrectHorse42!",
    }),
  );
  const login = await loginRoute.POST(
    jsonRequest("http://localhost/api/admin/auth/login", {
      identifier: "admin@example.com",
      password: "CorrectHorse42!",
    }),
  );
  const setCookie = login.headers.get("set-cookie");
  expect(setCookie).toContain(`${adminSessionCookieName}=`);

  return setCookie?.split(";")[0] ?? "";
};

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-caller-key-contract-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Caller Key 管理 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await callerKeysRoute.GET(
      nextRequest("http://localhost/api/admin/caller-keys"),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("覆盖 list/create/rotate/suspend/usage 且明文只在受控窗口返回", async () => {
    const cookie = await createAdminSessionCookie();
    const created = await callerKeysRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/caller-keys",
        {
          callerName: "Jellyfin Home",
          environment: "production",
          scope: "subtitles:read",
          quotaPolicy: "default",
        },
        cookie,
      ),
    );
    const createdPayload = await readJson<{
      data: {
        callerKey: { id: string; status: string; keySuffix: string };
        key: string;
      };
    }>(created);
    const keyId = createdPayload.data.callerKey.id;

    expect(created.status).toBe(201);
    expect(createdPayload.data.key).toMatch(/^subhub_live_/);
    expect(JSON.stringify(createdPayload.data.callerKey)).not.toContain(
      createdPayload.data.key,
    );

    const list = await callerKeysRoute.GET(
      nextRequest("http://localhost/api/admin/caller-keys", cookie),
    );
    await expect(readJson<{ data: { total: number } }>(list)).resolves.toEqual({
      data: expect.objectContaining({ total: 1 }),
    });

    const rotated = await rotateRoute.POST(
      nextRequest(
        `http://localhost/api/admin/caller-keys/${keyId}/rotate`,
        cookie,
        "POST",
      ),
      { params: { keyId } },
    );
    const rotatedPayload = await readJson<{
      data: { callerKey: { id: string; keySuffix: string }; key: string };
    }>(rotated);

    expect(rotatedPayload.data.key).not.toBe(createdPayload.data.key);
    expect(rotatedPayload.data.callerKey.keySuffix).not.toBe(
      createdPayload.data.callerKey.keySuffix,
    );

    const usage = await usageRoute.GET(
      nextRequest(
        `http://localhost/api/admin/caller-keys/${keyId}/usage`,
        cookie,
      ),
      { params: { keyId } },
    );
    await expect(
      readJson<{ data: { callerKeyId: string; recentRotations: unknown[] } }>(
        usage,
      ),
    ).resolves.toMatchObject({
      data: { callerKeyId: keyId, recentRotations: expect.any(Array) },
    });

    const suspended = await suspendRoute.POST(
      nextRequest(
        `http://localhost/api/admin/caller-keys/${rotatedPayload.data.callerKey.id}/suspend`,
        cookie,
        "POST",
      ),
      { params: { keyId: rotatedPayload.data.callerKey.id } },
    );
    await expect(
      readJson<{ data: { status: string } }>(suspended),
    ).resolves.toEqual({
      data: expect.objectContaining({ status: "suspended" }),
    });
  });

  it("malformed JSON 返回 400 校验错误而不是上游失败", async () => {
    const cookie = await createAdminSessionCookie();
    const response = await callerKeysRoute.POST(
      new NextRequest("http://localhost/api/admin/caller-keys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: "{not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expectApiError(response, "VALIDATION_FAILED");
  });
});
