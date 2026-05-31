import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "../helpers/pglite-storage-client";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as providersRoute from "@/app/api/admin/providers/route";
import * as providerDetailRoute from "@/app/api/admin/providers/[providerId]/route";
import * as providerEnableRoute from "@/app/api/admin/providers/[providerId]/enable/route";
import * as providerDisableRoute from "@/app/api/admin/providers/[providerId]/disable/route";
import * as credentialsRoute from "@/app/api/admin/providers/[providerId]/credentials/route";
import * as credentialIsolateRoute from "@/app/api/admin/providers/[providerId]/credentials/[credentialId]/isolate/route";
import * as credentialRestoreRoute from "@/app/api/admin/providers/[providerId]/credentials/[credentialId]/restore/route";
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
  tempDir = mkdtempSync(join(tmpdir(), "subhub-provider-contract-"));
  await setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closeStorageClient();
  await resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Provider 管理 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await providersRoute.GET(
      nextRequest("http://localhost/api/admin/providers"),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("覆盖 Provider list/create/get/update/enable/disable 与凭据 list/create/isolate/restore", async () => {
    const cookie = await createAdminSessionCookie();

    const created = await providersRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/providers",
        {
          name: "OpenSubtitles Primary",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "opensubtitles-api-key",
          },
        },
        cookie,
      ),
    );
    const createdPayload = await readJson<{
      data: {
        id: string;
        status: string;
        availableCredentialCount: number;
        credentials: Array<{ id: string; label: string; status: string }>;
      };
    }>(created);
    const providerId = createdPayload.data.id;
    const primaryCredentialId = createdPayload.data.credentials[0]!.id;

    expect(created.status).toBe(201);
    expect(createdPayload.data).toMatchObject({
      status: "enabled",
      availableCredentialCount: 1,
    });
    expect(JSON.stringify(createdPayload)).not.toContain(
      "opensubtitles-api-key",
    );

    const list = await providersRoute.GET(
      nextRequest("http://localhost/api/admin/providers", cookie),
    );
    await expect(readJson<{ data: { total: number } }>(list)).resolves.toEqual({
      data: expect.objectContaining({ total: 1 }),
    });

    const updated = await providerDetailRoute.PATCH(
      jsonRequest(
        `http://localhost/api/admin/providers/${providerId}`,
        { priority: 10, cooldownSeconds: 120 },
        cookie,
      ),
      { params: { providerId } },
    );
    await expect(
      readJson<{ data: { priority: number } }>(updated),
    ).resolves.toEqual({
      data: expect.objectContaining({ priority: 10 }),
    });

    const addedCredential = await credentialsRoute.POST(
      jsonRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials`,
        { label: "secondary", secret: "secondary-api-key" },
        cookie,
      ),
      { params: { providerId } },
    );
    const addedPayload = await readJson<{
      data: { id: string; status: string };
    }>(addedCredential);
    expect(addedCredential.status).toBe(201);
    expect(addedPayload.data.status).toBe("active");

    const credentials = await credentialsRoute.GET(
      nextRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials`,
        cookie,
      ),
      { params: { providerId } },
    );
    await expect(
      readJson<{ data: { total: number; items: Array<{ id: string }> } }>(
        credentials,
      ),
    ).resolves.toMatchObject({ data: { total: 2 } });

    const isolated = await credentialIsolateRoute.POST(
      jsonRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials/${primaryCredentialId}/isolate`,
        { reason: "429 限流" },
        cookie,
      ),
      { params: { providerId, credentialId: primaryCredentialId } },
    );
    const isolatedPayload = await readJson<{
      data: {
        credential: { status: string };
        provider: { availableCredentialCount: number };
      };
    }>(isolated);
    expect(isolatedPayload.data.credential.status).toBe("isolated");
    expect(isolatedPayload.data.provider.availableCredentialCount).toBe(1);

    const restored = await credentialRestoreRoute.POST(
      nextRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials/${primaryCredentialId}/restore`,
        cookie,
        "POST",
      ),
      { params: { providerId, credentialId: primaryCredentialId } },
    );
    await expect(
      readJson<{ data: { credential: { status: string } } }>(restored),
    ).resolves.toMatchObject({
      data: { credential: { status: "active" } },
    });

    const disabled = await providerDisableRoute.POST(
      nextRequest(
        `http://localhost/api/admin/providers/${providerId}/disable`,
        cookie,
        "POST",
      ),
      { params: { providerId } },
    );
    await expect(
      readJson<{ data: { status: string } }>(disabled),
    ).resolves.toEqual({
      data: expect.objectContaining({ status: "disabled" }),
    });

    const enabled = await providerEnableRoute.POST(
      nextRequest(
        `http://localhost/api/admin/providers/${providerId}/enable`,
        cookie,
        "POST",
      ),
      { params: { providerId } },
    );
    await expect(
      readJson<{ data: { status: string } }>(enabled),
    ).resolves.toEqual({
      data: expect.objectContaining({ status: "enabled" }),
    });

    const detail = await providerDetailRoute.GET(
      nextRequest(`http://localhost/api/admin/providers/${providerId}`, cookie),
      { params: { providerId } },
    );
    await expect(
      readJson<{ data: { id: string; credentials: unknown[] } }>(detail),
    ).resolves.toMatchObject({
      data: { id: providerId, credentials: expect.any(Array) },
    });
  });

  it("拒绝重复隔离已移出活跃池的凭据并返回明确原因", async () => {
    const cookie = await createAdminSessionCookie();

    const created = await providersRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/providers",
        {
          name: "OpenSubtitles Primary",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "opensubtitles-api-key",
          },
        },
        cookie,
      ),
    );
    const createdPayload = await readJson<{
      data: { id: string; credentials: Array<{ id: string }> };
    }>(created);
    const providerId = createdPayload.data.id;
    const credentialId = createdPayload.data.credentials[0]!.id;

    await credentialIsolateRoute.POST(
      jsonRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials/${credentialId}/isolate`,
        { reason: "429 限流" },
        cookie,
      ),
      { params: { providerId, credentialId } },
    );

    const repeated = await credentialIsolateRoute.POST(
      jsonRequest(
        `http://localhost/api/admin/providers/${providerId}/credentials/${credentialId}/isolate`,
        { reason: "重复隔离" },
        cookie,
      ),
      { params: { providerId, credentialId } },
    );

    await expectApiError(
      repeated,
      "VALIDATION_FAILED",
      "当前凭据已经不在活跃池中，无需重复隔离。",
    );
  });
});
