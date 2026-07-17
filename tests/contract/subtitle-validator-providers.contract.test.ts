import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as providersRoute from "@/app/api/admin/subtitle-validator/providers/route";
import { expectApiError } from "../helpers/api";
import {
  createProvider,
  disableProvider,
} from "@/server/services/provider-service";
import { subtitleValidatorProvidersResponseSchema } from "@/server/subtitles/admin-subtitle-validator-schema";

let tempDir: string;

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const nextRequest = (url: string, cookie?: string) =>
  new NextRequest(url, { headers: cookie ? { cookie } : undefined });

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
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-providers-contract-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator Provider 列表 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await providersRoute.GET(
      nextRequest("http://localhost/api/admin/subtitle-validator/providers"),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("保留 disabled provider，并返回能力摘要而不暴露凭据", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Disabled",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-secret",
      },
    });
    await disableProvider(provider.id);
    const cookie = await createAdminSessionCookie();

    const response = await providersRoute.GET(
      nextRequest(
        "http://localhost/api/admin/subtitle-validator/providers",
        cookie,
      ),
    );
    const payload = (await response.json()) as {
      data: {
        total: number;
        items: Array<{
          providerId: string;
          providerKey: string;
          providerName: string;
          status: string;
          requiresCredentials: boolean;
          credentialCount: number;
          availableCredentialCount: number;
          supportsDownloadValidation: boolean;
          supportsDirectDownloadUrl: boolean;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(
      subtitleValidatorProvidersResponseSchema.safeParse(payload).success,
    ).toBe(true);
    expect(payload.data.total).toBe(2);
    expect(payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: provider.id,
          providerKey: "opensubtitles",
          providerName: "OpenSubtitles Disabled",
          status: "disabled",
          requiresCredentials: true,
          credentialCount: 1,
          availableCredentialCount: 1,
          supportsDownloadValidation: true,
          supportsDirectDownloadUrl: false,
        }),
        expect.objectContaining({
          providerId: "xunlei-default",
          providerKey: "xunlei",
          requiresCredentials: false,
          supportsDownloadValidation: false,
          supportsDirectDownloadUrl: true,
        }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain("opensubtitles-secret");
  });
});
