import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requireCallerKey } from "@/server/api/caller-key-auth";
import {
  createCallerKey,
  getCallerKeyUsage,
  listCallerKeys,
  rotateCallerKey,
  suspendCallerKey,
} from "@/server/services/caller-key-service";
import { createCallerKeyRepository } from "@/server/caller-keys/caller-key-repository";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";

let tempDir: string;

const bearerRequest = (key: string) =>
  new Request("http://localhost/api/subtitles/search?title=Example", {
    headers: { authorization: ["Bearer", key].join(" ") },
  });

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-caller-key-service-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Caller Key service", () => {
  it("创建 Caller Key 只返回一次明文并在存储层隐藏 hash", async () => {
    const result = await createCallerKey({
      callerName: "Jellyfin Home",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    expect(result.key).toMatch(/^subhub_live_/);
    expect(result.callerKey).toMatchObject({
      callerName: "Jellyfin Home",
      status: "active",
      keyPrefix: expect.any(String),
      keySuffix: expect.any(String),
      revealUntil: expect.any(String),
    });
    expect(result.callerKey).not.toHaveProperty("keyHash");

    await expect(
      requireCallerKey({ request: bearerRequest(result.key) }),
    ).resolves.toMatchObject({ id: result.callerKey.id, status: "active" });
  });

  it("轮换后旧 Key 立即失效，新 Key 可用且记录轮换结果", async () => {
    const created = await createCallerKey({
      callerName: "Kodi",
      environment: "development",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    const rotated = await rotateCallerKey(created.callerKey.id, {
      actorAdminUserId: null,
    });

    expect(rotated.key).not.toBe(created.key);
    expect(rotated.callerKey.id).not.toBe(created.callerKey.id);
    expect(rotated.rotation).toMatchObject({
      callerKeyId: created.callerKey.id,
      result: "success",
      oldKeySuffix: created.callerKey.keySuffix,
      newKeySuffix: rotated.callerKey.keySuffix,
    });
    await expect(
      requireCallerKey({ request: bearerRequest(created.key) }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_INVALID" });
    await expect(
      requireCallerKey({ request: bearerRequest(rotated.key) }),
    ).resolves.toMatchObject({ id: rotated.callerKey.id });
    await expect(listCallerKeys()).resolves.toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: created.callerKey.id,
          status: "rotated",
        }),
        expect.objectContaining({ id: rotated.callerKey.id, status: "active" }),
      ]),
      total: 2,
    });
    await expect(
      rotateCallerKey(created.callerKey.id, { actorAdminUserId: null }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_INVALID" });
  });

  it("停用 Key 后立即拒绝新请求", async () => {
    const created = await createCallerKey({
      callerName: "Plex",
      environment: "staging",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await suspendCallerKey(created.callerKey.id);

    await expect(
      requireCallerKey({ request: bearerRequest(created.key) }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_SUSPENDED" });
  });

  it("使用摘要覆盖查询、下载、最近使用和轮换记录", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    const created = await createCallerKey(
      {
        callerName: "Infuse",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { now },
    );
    const repository = createCallerKeyRepository();

    await requireCallerKey({
      request: bearerRequest(created.key),
      now: new Date("2026-05-28T00:01:00.000Z"),
    });
    await repository.recordSearchRequest({
      callerKeyId: created.callerKey.id,
      mediaTitle: "Example",
      mediaYear: 2024,
      season: 1,
      episode: 2,
      language: "zh-CN",
      status: "success",
      resultCount: 1,
      providerId: null,
      credentialId: null,
      durationMs: 120,
      createdAt: "2026-05-28T00:01:01.000Z",
    });
    await repository.recordDownloadRequest({
      callerKeyId: created.callerKey.id,
      subtitleRef: "opensubtitles:provider_001:file_001",
      providerId: null,
      credentialId: null,
      status: "success",
      contentType: "application/x-subrip",
      durationMs: 80,
      createdAt: "2026-05-28T00:01:02.000Z",
    });
    await rotateCallerKey(created.callerKey.id, {
      actorAdminUserId: null,
      now: new Date("2026-05-28T00:02:00.000Z"),
    });

    await expect(
      getCallerKeyUsage(created.callerKey.id),
    ).resolves.toMatchObject({
      callerKeyId: created.callerKey.id,
      lastUsedAt: "2026-05-28T00:01:00.000Z",
      searchCount: 1,
      downloadCount: 1,
      recentSearches: [
        expect.objectContaining({
          mediaTitle: "Example",
          status: "success",
          resultCount: 1,
        }),
      ],
      recentDownloads: [
        expect.objectContaining({
          subtitleRef: "opensubtitles:provider_001:file_001",
          status: "success",
          contentType: "application/x-subrip",
        }),
      ],
      recentRotations: [
        expect.objectContaining({
          callerKeyId: created.callerKey.id,
          result: "success",
        }),
      ],
    });
  });
});
