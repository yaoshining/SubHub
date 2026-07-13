import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
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
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
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
    await expect(
      readJson<{
        data: {
          total: number;
          items: Array<{ id: string; type: string; name: string }>;
        };
      }>(list),
    ).resolves.toEqual({
      data: expect.objectContaining({
        total: 2,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "xunlei-default",
            type: "xunlei",
            name: "Xunlei",
          }),
          expect.objectContaining({
            id: providerId,
            type: "opensubtitles",
            name: "OpenSubtitles Primary",
          }),
        ]),
      }),
    });

    // Xunlei detail — verify stable empty credentials array
    const xunleiDetail = await providerDetailRoute.GET(
      nextRequest(
        "http://localhost/api/admin/providers/xunlei-default",
        cookie,
      ),
      { params: { providerId: "xunlei-default" } },
    );
    const xunleiDetailPayload = await readJson<{
      data: { id: string; type: string; credentials: unknown[] };
    }>(xunleiDetail);
    expect(xunleiDetailPayload.data).toMatchObject({
      id: "xunlei-default",
      type: "xunlei",
      credentials: [],
    });

    // Filter by type=xunlei
    const xunleiList = await providersRoute.GET(
      nextRequest("http://localhost/api/admin/providers?type=xunlei", cookie),
    );
    const xunleiListPayload = await readJson<{
      data: { items: Array<{ id: string; type: string }> };
    }>(xunleiList);
    expect(xunleiListPayload.data.items).toHaveLength(1);
    expect(xunleiListPayload.data.items[0]!.type).toBe("xunlei");

    // Filter by type=opensubtitles
    const osList = await providersRoute.GET(
      nextRequest(
        "http://localhost/api/admin/providers?type=opensubtitles",
        cookie,
      ),
    );
    const osListPayload = await readJson<{
      data: { items: Array<{ id: string; type: string }> };
    }>(osList);
    expect(
      osListPayload.data.items.every((p) => p.type === "opensubtitles"),
    ).toBe(true);
    expect(osListPayload.data.items.length).toBeGreaterThanOrEqual(1);

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

  describe("create provider type 限制契约 (US5)", () => {
    it("POST type=xunlei 被拒绝并返回明确限制语义 (VALIDATION_FAILED + target=type)", async () => {
      const cookie = await createAdminSessionCookie();

      const response = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "Xunlei Duplicate",
            type: "xunlei",
            initialCredential: {
              label: "primary",
              secret: "xunlei-not-creatable",
            },
          },
          cookie,
        ),
      );

      expect(response.status).toBe(400);
      const payload = await expectApiError(
        response,
        "VALIDATION_FAILED",
        "Xunlei 为预置 provider，单实例由 migration 接入；不支持通过此接口创建，如需恢复请走运维迁移。",
      );
      expect(payload.error.target).toBe("type");
    });

    it("POST 仍只允许创建 OpenSubtitles，OS 初始凭据创建路径兼容", async () => {
      const cookie = await createAdminSessionCookie();

      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "OpenSubtitles Contract Probe",
            type: "opensubtitles",
            initialCredential: {
              label: "primary",
              secret: "os-contract-probe-key",
            },
          },
          cookie,
        ),
      );

      expect(created.status).toBe(201);
      const createdPayload = await readJson<{
        data: { type: string; status: string; credentials: unknown[] };
      }>(created);
      expect(createdPayload.data.type).toBe("opensubtitles");
      expect(createdPayload.data.status).toBe("enabled");
      expect(createdPayload.data.credentials).toHaveLength(1);
      // 上游凭据明文不得回显
      expect(JSON.stringify(createdPayload)).not.toContain(
        "os-contract-probe-key",
      );
    });

    it("POST body 缺失 type 时以 VALIDATION_FAILED 拒绝 (不创造无 type 与 Xunlei 入口)", async () => {
      const cookie = await createAdminSessionCookie();

      const response = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "No Type Provider",
            initialCredential: { label: "primary", secret: "no-type-key" },
          },
          cookie,
        ),
      );

      expect(response.status).toBe(400);
      await expectApiError(response, "VALIDATION_FAILED");
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

  describe("enable / disable contract", () => {
    it("returns full provider summary on enable success", async () => {
      const cookie = await createAdminSessionCookie();

      // Create a disabled provider with credentials
      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "Test Provider for Enable",
            type: "opensubtitles",
            initialCredential: {
              label: "test-credential",
              secret: "test-api-key",
            },
          },
          cookie,
        ),
      );
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      const providerId = createdPayload.data.id;

      // Disable it first
      await providerDisableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/disable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      // Now enable it
      const enabled = await providerEnableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/enable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      expect(enabled.status).toBe(200);
      const enabledPayload = await readJson<{
        data: {
          id: string;
          name: string;
          type: string;
          status: string;
          priority: number;
          cooldownSeconds: number;
          availableCredentialCount: number;
          credentials: Array<{ id: string; label: string; status: string }>;
        };
      }>(enabled);

      expect(enabledPayload.data).toMatchObject({
        id: providerId,
        name: "Test Provider for Enable",
        type: "opensubtitles",
        status: "enabled",
        priority: expect.any(Number),
        cooldownSeconds: expect.any(Number),
        availableCredentialCount: 1,
      });
      expect(enabledPayload.data.credentials).toHaveLength(1);
      expect(enabledPayload.data.credentials[0]).toMatchObject({
        id: expect.any(String),
        label: "test-credential",
        status: "active",
      });
    });

    it("returns full provider summary on disable success", async () => {
      const cookie = await createAdminSessionCookie();

      // Create an enabled provider with credentials
      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "Test Provider for Disable",
            type: "opensubtitles",
            initialCredential: {
              label: "test-credential",
              secret: "test-api-key",
            },
          },
          cookie,
        ),
      );
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      const providerId = createdPayload.data.id;

      // Disable it
      const disabled = await providerDisableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/disable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      expect(disabled.status).toBe(200);
      const disabledPayload = await readJson<{
        data: {
          id: string;
          name: string;
          type: string;
          status: string;
          priority: number;
          cooldownSeconds: number;
          availableCredentialCount: number;
          credentials: Array<{ id: string; label: string; status: string }>;
        };
      }>(disabled);

      expect(disabledPayload.data).toMatchObject({
        id: providerId,
        name: "Test Provider for Disable",
        type: "opensubtitles",
        status: "disabled",
        priority: expect.any(Number),
        cooldownSeconds: expect.any(Number),
        availableCredentialCount: 1,
      });
      expect(disabledPayload.data.credentials).toHaveLength(1);
    });

    it("rejects enabling OS provider without active credentials", async () => {
      const cookie = await createAdminSessionCookie();

      // Create a provider with credential
      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "OS Provider Without Creds",
            type: "opensubtitles",
            initialCredential: {
              label: "to-be-isolated",
              secret: "test-api-key",
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

      // Isolate the only credential
      await credentialIsolateRoute.POST(
        jsonRequest(
          `http://localhost/api/admin/providers/${providerId}/credentials/${credentialId}/isolate`,
          { reason: "test isolation" },
          cookie,
        ),
        { params: { providerId, credentialId } },
      );

      // Disable the provider
      await providerDisableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/disable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      // Try to enable it without active credentials
      const enableAttempt = await providerEnableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/enable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      await expectApiError(enableAttempt, "PROVIDER_CREDENTIAL_EXHAUSTED");
    });

    it("returns PROVIDER_UNAVAILABLE when enabling non-existent provider", async () => {
      const cookie = await createAdminSessionCookie();

      const enableAttempt = await providerEnableRoute.POST(
        nextRequest(
          "http://localhost/api/admin/providers/non-existent-provider/enable",
          cookie,
          "POST",
        ),
        { params: { providerId: "non-existent-provider" } },
      );

      await expectApiError(enableAttempt, "PROVIDER_UNAVAILABLE");
    });

    it("allows idempotent operations - enabling already-enabled provider returns 200", async () => {
      const cookie = await createAdminSessionCookie();

      // Create an enabled provider
      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name: "Already Enabled Provider",
            type: "opensubtitles",
            initialCredential: {
              label: "test-credential",
              secret: "test-api-key",
            },
          },
          cookie,
        ),
      );
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      const providerId = createdPayload.data.id;

      // Try to enable it again (it's already enabled) - should succeed idempotently
      const enableAgain = await providerEnableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/enable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      expect(enableAgain.status).toBe(200);
      const enableAgainPayload = await readJson<{
        data: { status: string };
      }>(enableAgain);
      expect(enableAgainPayload.data.status).toBe("enabled");

      // Disable it
      await providerDisableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/disable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      // Try to disable it again (it's already disabled) - should succeed idempotently
      const disableAgain = await providerDisableRoute.POST(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}/disable`,
          cookie,
          "POST",
        ),
        { params: { providerId } },
      );

      expect(disableAgain.status).toBe(200);
      const disableAgainPayload = await readJson<{
        data: { status: string };
      }>(disableAgain);
      expect(disableAgainPayload.data.status).toBe("disabled");
    });
  });

  describe("健康字段契约", () => {
    // Helpers: OpenAPI declares `lastHealthStatus / lastErrorSummary` as
    // nullable string and `lastHealthCheckedAt` as nullable string (date-time).
    // We assert each value is either null or a string; for lastHealthCheckedAt
    // we also confirm it's a valid ISO date-time when present.
    const assertNullableString = (value: unknown) => {
      expect(value === null || typeof value === "string").toBe(true);
    };
    const assertNullableIsoDateTime = (value: unknown) => {
      if (value === null) return;
      expect(typeof value).toBe("string");
      // Accept strict ISO 8601 ("T" separator, "+HH:MM" tz) as declared by
      // OpenAPI `format: date-time`, plus PGlite's space-separator / short
      // offset form ("+08"). Timezone is required: either `Z`/`z` or a
      // numeric offset, so missing-tz strings cannot slip through.
      expect(value as string).toMatch(
        /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)$/,
      );
      expect(Number.isFinite(new Date(value as string).getTime())).toBe(true);
    };

    it("GET /api/admin/providers list items include lastHealthStatus / lastErrorSummary / lastHealthCheckedAt", async () => {
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
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      const providerId = createdPayload.data.id;

      const list = await providersRoute.GET(
        nextRequest("http://localhost/api/admin/providers", cookie),
      );
      const listPayload = await readJson<{
        data: {
          items: Array<{
            id: string;
            lastHealthStatus: unknown;
            lastErrorSummary: unknown;
            lastHealthCheckedAt: unknown;
          }>;
        };
      }>(list);

      expect(listPayload.data.items.length).toBeGreaterThanOrEqual(2);

      for (const item of listPayload.data.items) {
        assertNullableString(item.lastHealthStatus);
        assertNullableString(item.lastErrorSummary);
        assertNullableIsoDateTime(item.lastHealthCheckedAt);
      }

      // The newly created provider should expose a normalized "ready" state
      // because we passed an initialCredential at creation time.
      const newItem = listPayload.data.items.find(
        (item) => item.id === providerId,
      );
      expect(newItem).toBeDefined();
      expect(newItem?.lastHealthStatus).toBe("ready");
      expect(newItem?.lastErrorSummary).toBeNull();
      assertNullableIsoDateTime(newItem?.lastHealthCheckedAt ?? null);
    });

    it("GET /api/admin/providers/{providerId} detail includes lastHealthStatus / lastErrorSummary / lastHealthCheckedAt", async () => {
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
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      const providerId = createdPayload.data.id;

      const detail = await providerDetailRoute.GET(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}`,
          cookie,
        ),
        { params: { providerId } },
      );
      const detailPayload = await readJson<{
        data: {
          lastHealthStatus: unknown;
          lastErrorSummary: unknown;
          lastHealthCheckedAt: unknown;
        };
      }>(detail);

      expect(detail.status).toBe(200);
      expect(detailPayload.data.lastHealthStatus).toBe("ready");
      expect(detailPayload.data.lastErrorSummary).toBeNull();
      assertNullableIsoDateTime(detailPayload.data.lastHealthCheckedAt);
    });

    it("新建带 initialCredential 的 provider 初始化健康字段为 ready / errorSummary=null / checkedAt 符合 schema 真源", async () => {
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
          lastHealthStatus: unknown;
          lastErrorSummary: unknown;
          lastHealthCheckedAt: unknown;
        };
      }>(created);

      expect(created.status).toBe(201);
      expect(createdPayload.data.lastHealthStatus).toBe("ready");
      expect(createdPayload.data.lastErrorSummary).toBeNull();
      // provider-repository.createProvider does not set lastHealthCheckedAt
      // on insert; per schema/migration the column defaults to NULL until a
      // health check actually runs. Accept either NULL (current code path)
      // or a valid ISO date-time string (forward-compatible).
      assertNullableIsoDateTime(createdPayload.data.lastHealthCheckedAt);
    });

    it("Xunlei seeded instance 的健康字段存在且符合 schema 真源", async () => {
      const cookie = await createAdminSessionCookie();

      const list = await providersRoute.GET(
        nextRequest("http://localhost/api/admin/providers", cookie),
      );
      const listPayload = await readJson<{
        data: {
          items: Array<{
            id: string;
            type: string;
            lastHealthStatus: unknown;
            lastErrorSummary: unknown;
            lastHealthCheckedAt: unknown;
          }>;
        };
      }>(list);

      const xunlei = listPayload.data.items.find(
        (item) => item.id === "xunlei-default",
      );
      expect(xunlei).toBeDefined();

      // After migration 003 the seeded xunlei row has last_health_status =
      // 'unknown' (set by the migration's UPDATE). applyManagedSeed (bootstrap
      // path) writes 'seeded'. We accept any known runtime / seed status or
      // null to keep the assertion informative without coupling to a single
      // bootstrap branch.
      expect(xunlei?.lastHealthStatus).toMatch(
        /^(unknown|seeded|ready|healthy|degraded)$/,
      );
      assertNullableString(xunlei?.lastErrorSummary);
      assertNullableIsoDateTime(xunlei?.lastHealthCheckedAt);
    });
  });

  describe("PATCH /api/admin/providers/{providerId} 配置保存契约", () => {
    const createOpenSubtitles = async (
      cookie: string,
      name: string,
    ): Promise<string> => {
      const created = await providersRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/providers",
          {
            name,
            type: "opensubtitles",
            initialCredential: {
              label: `${name}-key`,
              secret: `${name}-api-key`,
            },
          },
          cookie,
        ),
      );
      const createdPayload = await readJson<{ data: { id: string } }>(created);
      expect(created.status).toBe(201);
      return createdPayload.data.id;
    };

    const patchProvider = (
      providerId: string,
      body: Record<string, unknown>,
      cookie: string,
    ) =>
      providerDetailRoute.PATCH(
        jsonRequest(
          `http://localhost/api/admin/providers/${providerId}`,
          body,
          cookie,
        ),
        { params: { providerId } },
      );

    const getProvider = async (
      providerId: string,
      cookie: string,
    ): Promise<{
      priority: number;
      weight: number;
      concurrencyLimit: number;
      cooldownSeconds: number;
      rotationEnabled: boolean;
      fallbackProviderId: string | null;
      updatedAt: string;
    }> => {
      const detail = await providerDetailRoute.GET(
        nextRequest(
          `http://localhost/api/admin/providers/${providerId}`,
          cookie,
        ),
        { params: { providerId } },
      );
      const payload = await readJson<{ data: Record<string, unknown> }>(detail);
      return payload.data as Awaited<ReturnType<typeof getProvider>>;
    };

    it("合法保存 priority/weight/concurrency/cooldown/rotation/fallback 可持久化并刷新 updatedAt", async () => {
      const cookie = await createAdminSessionCookie();
      const providerAId = await createOpenSubtitles(cookie, "OS Alpha");
      const providerBId = await createOpenSubtitles(cookie, "OS Beta");
      const before = await getProvider(providerAId, cookie);

      const updated = await patchProvider(
        providerAId,
        {
          priority: 30,
          weight: 7,
          concurrencyLimit: 3,
          cooldownSeconds: 90,
          rotationEnabled: false,
          fallbackProviderId: providerBId,
        },
        cookie,
      );
      expect(updated.status).toBe(200);
      const updatedPayload = await readJson<{
        data: {
          priority: number;
          weight: number;
          concurrencyLimit: number;
          cooldownSeconds: number;
          rotationEnabled: boolean;
          fallbackProviderId: string;
          updatedAt: string;
        };
      }>(updated);
      expect(updatedPayload.data).toMatchObject({
        priority: 30,
        weight: 7,
        concurrencyLimit: 3,
        cooldownSeconds: 90,
        rotationEnabled: false,
        fallbackProviderId: providerBId,
      });
      expect(updatedPayload.data.updatedAt).not.toBe(before.updatedAt);

      // 重新读取应反映持久化结果
      const after = await getProvider(providerAId, cookie);
      expect(after).toMatchObject({
        priority: 30,
        weight: 7,
        concurrencyLimit: 3,
        cooldownSeconds: 90,
        rotationEnabled: false,
        fallbackProviderId: providerBId,
      });
    });

    it("fallback 指向不存在的 provider 时返回字段级错误", async () => {
      const cookie = await createAdminSessionCookie();
      const providerAId = await createOpenSubtitles(cookie, "OS Alpha");

      const response = await patchProvider(
        providerAId,
        { fallbackProviderId: "provider_does_not_exist" },
        cookie,
      );

      expect(response.status).toBe(400);
      const payload = await expectApiError(response, "VALIDATION_FAILED");
      expect(payload.error.target).toBe("fallbackProviderId");
    });

    it("fallback 自引用时返回字段级错误", async () => {
      const cookie = await createAdminSessionCookie();
      const providerAId = await createOpenSubtitles(cookie, "OS Alpha");

      const response = await patchProvider(
        providerAId,
        { fallbackProviderId: providerAId },
        cookie,
      );

      expect(response.status).toBe(400);
      const payload = await expectApiError(response, "VALIDATION_FAILED");
      expect(payload.error.target).toBe("fallbackProviderId");
      expect(payload.error.message).toMatch(/自引用|自身/);
    });

    it("fallback 形成循环引用时返回字段级错误", async () => {
      const cookie = await createAdminSessionCookie();
      const providerAId = await createOpenSubtitles(cookie, "OS Alpha");
      const providerBId = await createOpenSubtitles(cookie, "OS Beta");

      // A → B
      const first = await patchProvider(
        providerAId,
        { fallbackProviderId: providerBId },
        cookie,
      );
      expect(first.status).toBe(200);

      // B → A 应形成 A → B → A 循环，被拒绝
      const response = await patchProvider(
        providerBId,
        { fallbackProviderId: providerAId },
        cookie,
      );

      expect(response.status).toBe(400);
      const payload = await expectApiError(response, "VALIDATION_FAILED");
      expect(payload.error.target).toBe("fallbackProviderId");
      expect(payload.error.message).toMatch(/循环/);
    });

    it("Xunlei 提交 rotationEnabled 时被静默忽略且不报错", async () => {
      const cookie = await createAdminSessionCookie();
      const before = await getProvider("xunlei-default", cookie);
      expect(before.rotationEnabled).toBe(false);

      const response = await patchProvider(
        "xunlei-default",
        { rotationEnabled: true },
        cookie,
      );

      expect(response.status).toBe(200);
      const after = await getProvider("xunlei-default", cookie);
      // rotationEnabled 对 Xunlei 当前不适用，不应被写入
      expect(after.rotationEnabled).toBe(false);
    });
  });
});
