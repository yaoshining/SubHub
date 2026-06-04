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
  type PGliteTestHarness,
  createPGliteTestHarness,
} from "../../helpers/pglite-storage";

let harness: PGliteTestHarness;

const bearerRequest = (key: string) =>
  new Request("http://localhost/api/subtitles/search?title=Example", {
    headers: { authorization: ["Bearer", key].join(" ") },
  });

beforeEach(async () => {
  harness = await createPGliteTestHarness();
});

afterEach(async () => {
  await harness.close();
});

describe("Caller Key service", () => {
  it("列表摘要按最近 30 天轮换事件计数，而不是按 rotated 条目近似", async () => {
    const now = new Date("2026-05-28T12:00:00.000Z");
    const created = await createCallerKey(
      {
        callerName: "Jellyfin Home",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { db: harness.db, now },
    );

    const firstRotation = await rotateCallerKey(created.callerKey.id, {
      db: harness.db,
      actorAdminUserId: null,
      now: new Date("2026-05-10T12:00:00.000Z"),
    });

    await rotateCallerKey(firstRotation.callerKey.id, {
      db: harness.db,
      actorAdminUserId: null,
      now: new Date("2026-04-15T12:00:00.000Z"),
    });

    await expect(
      listCallerKeys({ db: harness.db, now }),
    ).resolves.toMatchObject({
      total: 3,
      summary: {
        activeCount: 1,
        suspendedCount: 0,
        quotaAlertCount: 0,
        rotationCount30d: 1,
      },
    });
  });

  it("创建 Caller Key 只返回一次明文并在存储层隐藏 hash", async () => {
    const result = await createCallerKey(
      {
        callerName: "Jellyfin Home",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { db: harness.db },
    );

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
      requireCallerKey({ request: bearerRequest(result.key), db: harness.db }),
    ).resolves.toMatchObject({ id: result.callerKey.id, status: "active" });
  });

  it("轮换后旧 Key 立即失效，新 Key 可用且记录轮换结果", async () => {
    const created = await createCallerKey(
      {
        callerName: "Kodi",
        environment: "development",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { db: harness.db },
    );

    const rotated = await rotateCallerKey(created.callerKey.id, {
      db: harness.db,
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
      requireCallerKey({ request: bearerRequest(created.key), db: harness.db }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_INVALID" });
    await expect(
      requireCallerKey({ request: bearerRequest(rotated.key), db: harness.db }),
    ).resolves.toMatchObject({ id: rotated.callerKey.id });
    await expect(listCallerKeys({ db: harness.db })).resolves.toMatchObject({
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
      rotateCallerKey(created.callerKey.id, {
        db: harness.db,
        actorAdminUserId: null,
      }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_INVALID" });
  });

  it("停用 Key 后立即拒绝新请求", async () => {
    const created = await createCallerKey(
      {
        callerName: "Plex",
        environment: "staging",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { db: harness.db },
    );

    await suspendCallerKey(created.callerKey.id, { db: harness.db });

    await expect(
      requireCallerKey({ request: bearerRequest(created.key), db: harness.db }),
    ).rejects.toMatchObject({ code: "CALLER_KEY_SUSPENDED" });
  });

  it("使用摘要按最近 24 小时统计且不被最近记录列表上限截断", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    const created = await createCallerKey(
      {
        callerName: "Infuse",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      { db: harness.db, now },
    );
    const repository = createCallerKeyRepository(harness.db);

    await requireCallerKey({
      request: bearerRequest(created.key),
      db: harness.db,
      now: new Date("2026-05-28T00:01:00.000Z"),
    });
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        repository.recordSearchRequest({
          callerKeyId: created.callerKey.id,
          mediaTitle: `Example ${index + 1}`,
          mediaYear: 2024,
          season: 1,
          episode: index + 1,
          language: "zh-CN",
          status: "success",
          resultCount: 1,
          providerId: null,
          credentialId: null,
          durationMs: 120,
          createdAt: new Date(
            Date.parse("2026-05-28T00:01:01.000Z") + index * 60_000,
          ).toISOString(),
        }),
      ),
    );
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        repository.recordDownloadRequest({
          callerKeyId: created.callerKey.id,
          subtitleRef: `opensubtitles:provider_001:file_${String(index + 1).padStart(3, "0")}`,
          providerId: null,
          credentialId: null,
          status: "success",
          contentType: "application/x-subrip",
          durationMs: 80,
          createdAt: new Date(
            Date.parse("2026-05-28T00:01:02.000Z") + index * 60_000,
          ).toISOString(),
        }),
      ),
    );
    await repository.recordSearchRequest({
      callerKeyId: created.callerKey.id,
      mediaTitle: "Old request",
      mediaYear: 2023,
      season: 1,
      episode: 1,
      language: "zh-CN",
      status: "success",
      resultCount: 1,
      providerId: null,
      credentialId: null,
      durationMs: 150,
      createdAt: "2026-05-26T23:59:59.000Z",
    });
    await repository.recordDownloadRequest({
      callerKeyId: created.callerKey.id,
      subtitleRef: "opensubtitles:provider_001:file_old",
      providerId: null,
      credentialId: null,
      status: "success",
      contentType: "application/x-subrip",
      durationMs: 90,
      createdAt: "2026-05-26T23:59:59.000Z",
    });
    await rotateCallerKey(created.callerKey.id, {
      db: harness.db,
      actorAdminUserId: null,
      now: new Date("2026-05-28T00:02:00.000Z"),
    });

    const usageSummary = await getCallerKeyUsage(created.callerKey.id, {
      db: harness.db,
      now,
    });

    expect(usageSummary).toMatchObject({
      callerKeyId: created.callerKey.id,
      searchCount: 21,
      downloadCount: 21,
      recentSearches: expect.arrayContaining([
        expect.objectContaining({
          mediaTitle: "Example 21",
          status: "success",
          resultCount: 1,
        }),
      ]),
      recentDownloads: expect.arrayContaining([
        expect.objectContaining({
          subtitleRef: "opensubtitles:provider_001:file_021",
          status: "success",
          contentType: "application/x-subrip",
        }),
      ]),
    });
    expect(Date.parse(usageSummary.lastUsedAt ?? "")).toBe(
      Date.parse("2026-05-28T00:01:00.000Z"),
    );
    expect(usageSummary.recentRotations).toEqual([
      expect.objectContaining({
        callerKeyId: created.callerKey.id,
        result: "success",
      }),
    ]);
    expect(usageSummary.recentSearches).toHaveLength(20);
    expect(usageSummary.recentDownloads).toHaveLength(20);
    expect(
      usageSummary.recentSearches.some(
        (search) => search.mediaTitle === "Old request",
      ),
    ).toBe(false);
    expect(
      usageSummary.recentDownloads.some(
        (download) =>
          download.subtitleRef === "opensubtitles:provider_001:file_old",
      ),
    ).toBe(false);
  });
});
