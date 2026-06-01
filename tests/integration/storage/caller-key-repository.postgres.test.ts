import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { CallerKeyRepository } from "@/server/caller-keys/caller-key-repository";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  callerKeyRotations,
  callerKeys,
  subtitleDownloadRequests,
  subtitleSearchRequests,
} from "@/server/storage/schema";
import {
  buildLocalTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateCallerKeyTablesSql =
  'TRUNCATE TABLE "subtitle_download_requests", "subtitle_search_requests", "caller_key_rotations", "caller_keys" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled("CallerKeyRepository on local Docker Postgres", () => {
  const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
  const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();

  let repository: CallerKeyRepository;
  let closeStorageClient: (() => Promise<void>) | undefined;
  let closeDirectClient: (() => Promise<void>) | undefined;
  let directDb:
    | ReturnType<typeof createDirectPostgresClient>["db"]
    | undefined;
  let directSql:
    | ReturnType<typeof createDirectPostgresClient>["sql"]
    | undefined;

  beforeAll(async () => {
    Object.assign(process.env, testEnv);

    const storageClient = createStorageClient({
      runtimeDatabaseUrl: runtimeUrl,
      directDatabaseUrl: directUrl,
    });

    await storageClient.migrate();

    repository = new CallerKeyRepository(storageClient.db);
    closeStorageClient = () => storageClient.close();

    const directClient = createDirectPostgresClient({
      directDatabaseUrl: directUrl,
    });

    directDb = directClient.db;
    directSql = directClient.sql;
    closeDirectClient = () => directClient.close();
  });

  beforeEach(async () => {
    await directSql?.unsafe(truncateCallerKeyTablesSql);
  });

  afterAll(async () => {
    await closeStorageClient?.();
    await closeDirectClient?.();
  });

  it("rotates caller keys transactionally on the real Postgres path", async () => {
    const created = await repository.createCallerKey(
      {
        callerName: "Jellyfin Home",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      new Date("2026-06-01T00:00:00.000Z"),
    );

    const rotated = await repository.rotateCallerKey(
      created.callerKey.id,
      null,
      new Date("2026-06-01T00:05:00.000Z"),
    );

    expect(rotated.key).toMatch(/^subhub_live_/);
    expect(rotated.key).not.toBe(created.key);
    expect(rotated.callerKey.id).not.toBe(created.callerKey.id);
    expect(rotated.rotation).toMatchObject({
      callerKeyId: created.callerKey.id,
      result: "success",
      oldKeySuffix: created.callerKey.keySuffix,
      newKeySuffix: rotated.callerKey.keySuffix,
    });

    const persistedKeys = await directDb?.select().from(callerKeys);
    const persistedRotations = await directDb?.select().from(callerKeyRotations);

    expect(persistedKeys).toHaveLength(2);
    expect(persistedKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.callerKey.id, status: "rotated" }),
        expect.objectContaining({ id: rotated.callerKey.id, status: "active" }),
      ]),
    );
    expect(persistedRotations).toEqual([
      expect.objectContaining({
        callerKeyId: created.callerKey.id,
        result: "success",
      }),
    ]);
  });

  it("keeps 24h usage counts and recent-item limits on the real Postgres path", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const created = await repository.createCallerKey(
      {
        callerName: "Infuse",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      },
      now,
    );

    await directDb
      ?.update(callerKeys)
      .set({ lastUsedAt: "2026-06-01T00:01:00.000Z" })
      .where(eq(callerKeys.id, created.callerKey.id));

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
          createdAt: new Date(now.getTime() + 61_000 + index * 60_000).toISOString(),
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
          createdAt: new Date(now.getTime() + 62_000 + index * 60_000).toISOString(),
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
      createdAt: "2026-05-30T23:59:59.000Z",
    });
    await repository.recordDownloadRequest({
      callerKeyId: created.callerKey.id,
      subtitleRef: "opensubtitles:provider_001:file_old",
      providerId: null,
      credentialId: null,
      status: "success",
      contentType: "application/x-subrip",
      durationMs: 90,
      createdAt: "2026-05-30T23:59:59.000Z",
    });
    await repository.rotateCallerKey(
      created.callerKey.id,
      null,
      new Date("2026-06-01T00:02:00.000Z"),
    );

    const usageSummary = await repository.getUsageSummary(created.callerKey.id, now);
    const persistedSearches = await directDb?.select().from(subtitleSearchRequests);
    const persistedDownloads = await directDb?.select().from(subtitleDownloadRequests);

    expect(persistedSearches).toHaveLength(22);
    expect(persistedDownloads).toHaveLength(22);
    expect(usageSummary).toMatchObject({
      callerKeyId: created.callerKey.id,
      searchCount: 21,
      downloadCount: 21,
      recentRotations: [
        expect.objectContaining({
          callerKeyId: created.callerKey.id,
          result: "success",
        }),
      ],
    });
    expect(Date.parse(usageSummary.lastUsedAt ?? "")).toBe(
      Date.parse("2026-06-01T00:01:00.000Z"),
    );
    expect(usageSummary.recentSearches).toHaveLength(20);
    expect(usageSummary.recentDownloads).toHaveLength(20);
    expect(usageSummary.recentSearches[0]).toMatchObject({
      mediaTitle: "Example 21",
      status: "success",
    });
    expect(usageSummary.recentDownloads[0]).toMatchObject({
      subtitleRef: "opensubtitles:provider_001:file_021",
      status: "success",
    });
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