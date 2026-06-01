import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import { ProviderRepository } from "@/server/providers/provider-repository";
import { createCallerKeyRepository } from "@/server/caller-keys/caller-key-repository";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import { searchSubtitles } from "@/server/subtitles/subtitle-gateway";
import { downloadSubtitle } from "@/server/subtitles/subtitle-download";
import {
  providerCredentials,
  subtitleSearchRequests,
  subtitleDownloadRequests,
  providers,
  callerKeys,
  callerKeyRotations,
} from "@/server/storage/schema";
import {
  buildLocalTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateSubtitleTablesSql =
  'TRUNCATE TABLE "subtitle_search_requests", "subtitle_download_requests", "caller_key_rotations", "caller_keys", "provider_credentials", "providers" RESTART IDENTITY CASCADE';

const makeRequest = (key: string) =>
  new Request("http://localhost/api/subtitles/search?title=Example", {
    headers: { authorization: `Bearer ${key}` },
  });

const makeDownloadRequest = (key: string) =>
  new Request(
    "http://localhost/api/subtitles/download?subtitleId=opensubtitles:provider:file_001",
    {
      headers: { authorization: `Bearer ${key}` },
    },
  );

describeWhenLocalPostgresEnabled(
  "Subtitle gateway failure persistence on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();
    const now = new Date("2026-06-01T00:00:00.000Z");

    let closeStorageClient: (() => Promise<void>) | undefined;
    let closeDirectClient: (() => Promise<void>) | undefined;
    let directDb:
      | ReturnType<typeof createDirectPostgresClient>["db"]
      | undefined;
    let directSql:
      | ReturnType<typeof createDirectPostgresClient>["sql"]
      | undefined;
    let providerRepository: ProviderRepository;
    let callerKeyRepository: ReturnType<typeof createCallerKeyRepository>;

    const setupProviderWithCredential = async () => {
      const provider = await providerRepository.createProvider(
        {
          name: "OpenSubtitles Primary",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "opensubtitles-api-key",
          },
        },
        now,
      );
      const credentialId = provider.credentials[0]!.id;
      return { provider, credentialId };
    };

    const setupCallerKey = async () => {
      return callerKeyRepository.createCallerKey(
        {
          callerName: "Jellyfin",
          environment: "production",
          scope: "subtitles:read",
          quotaPolicy: "default",
        },
        now,
      );
    };

    beforeAll(async () => {
      Object.assign(process.env, testEnv);

      const storageClient = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      await storageClient.migrate();

      providerRepository = new ProviderRepository(storageClient.db);
      callerKeyRepository = createCallerKeyRepository(storageClient.db);
      closeStorageClient = () => storageClient.close();

      const directClient = createDirectPostgresClient({
        directDatabaseUrl: directUrl,
      });

      directDb = directClient.db;
      directSql = directClient.sql;
      closeDirectClient = () => directClient.close();
    });

    beforeEach(async () => {
      await directSql?.unsafe(truncateSubtitleTablesSql);
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
    });

    it("persists credential cooldown and provider_failed search request on upstream failure", async () => {
      const { provider, credentialId } = await setupProviderWithCredential();
      const callerKey = await setupCallerKey();

      await expect(
        searchSubtitles(
          makeRequest(callerKey.key),
          { title: "Example" },
          {
            db: providerRepository["db"],
            now,
            adapter: {
              search: async () => {
                throw new AppError(
                  "PROVIDER_CREDENTIAL_EXHAUSTED",
                  "429 限流",
                  "rate_limited",
                );
              },
            },
          },
        ),
      ).rejects.toMatchObject<AppError>({
        code: "UPSTREAM_FAILED",
        target: "provider",
      });

      const persistedCredential = await directDb
        ?.select()
        .from(providerCredentials)
        .where(eq(providerCredentials.id, credentialId))
        .then((rows) => rows[0]);

      expect(persistedCredential).toBeDefined();
      expect(persistedCredential?.status).toBe("cooldown");
      expect(persistedCredential?.lastErrorSummary).toBe("429 限流");
      expect(persistedCredential?.cooldownUntil).toBeDefined();

      const persistedProvider = await directDb
        ?.select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .then((rows) => rows[0]);

      expect(persistedProvider?.status).toBe("degraded");
      expect(persistedProvider?.lastHealthStatus).toBe("degraded");

      const requests = await directDb
        ?.select()
        .from(subtitleSearchRequests)
        .where(eq(subtitleSearchRequests.callerKeyId, callerKey.callerKey.id));

      expect(requests).toHaveLength(1);
      expect(requests?.[0]).toMatchObject({
        status: "provider_failed",
        providerId: provider.id,
        credentialId,
        resultCount: 0,
      });
    });

    it("persists credential exhaustion and provider degradation when quota is exhausted", async () => {
      const { provider, credentialId } = await setupProviderWithCredential();
      const callerKey = await setupCallerKey();

      await expect(
        searchSubtitles(
          makeRequest(callerKey.key),
          { title: "Example" },
          {
            db: providerRepository["db"],
            now,
            adapter: {
              search: async () => {
                throw new AppError(
                  "PROVIDER_CREDENTIAL_EXHAUSTED",
                  "quota exhausted",
                  "authentication_failed",
                );
              },
            },
          },
        ),
      ).rejects.toMatchObject<AppError>({
        code: "UPSTREAM_FAILED",
        target: "provider",
      });

      const persistedCredential = await directDb
        ?.select()
        .from(providerCredentials)
        .where(eq(providerCredentials.id, credentialId))
        .then((rows) => rows[0]);

      expect(persistedCredential?.status).toBe("exhausted");
      expect(persistedCredential?.cooldownUntil).toBeNull();

      const persistedProvider = await directDb
        ?.select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .then((rows) => rows[0]);

      expect(persistedProvider?.status).toBe("degraded");
      expect(persistedProvider?.lastHealthStatus).toBe("degraded");
    });

    it("persists credential cooldown and provider_failed download request on download failure", async () => {
      const { provider, credentialId } = await setupProviderWithCredential();
      const callerKey = await setupCallerKey();
      const subtitleRef = `opensubtitles:${provider.id}:file_001`;

      await expect(
        downloadSubtitle(makeDownloadRequest(callerKey.key), subtitleRef, {
          db: providerRepository["db"],
          now,
          adapter: {
            download: async () => {
              throw new AppError(
                "PROVIDER_CREDENTIAL_EXHAUSTED",
                "上游限流",
                "rate_limited",
              );
            },
          },
        }),
      ).rejects.toMatchObject<AppError>({
        code: "UPSTREAM_FAILED",
        target: "provider",
      });

      const persistedCredential = await directDb
        ?.select()
        .from(providerCredentials)
        .where(eq(providerCredentials.id, credentialId))
        .then((rows) => rows[0]);

      expect(persistedCredential?.status).toBe("cooldown");
      expect(persistedCredential?.lastErrorSummary).toBe("上游限流");

      const persistedProvider = await directDb
        ?.select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .then((rows) => rows[0]);

      expect(persistedProvider?.status).toBe("degraded");
      expect(persistedProvider?.lastHealthStatus).toBe("degraded");

      const downloadRequests = await directDb
        ?.select()
        .from(subtitleDownloadRequests)
        .where(
          eq(subtitleDownloadRequests.callerKeyId, callerKey.callerKey.id),
        );

      expect(downloadRequests).toHaveLength(1);
      expect(downloadRequests?.[0]).toMatchObject({
        status: "provider_failed",
        subtitleRef,
        providerId: provider.id,
        credentialId,
      });
    });

    it("records unauthorized search request without affecting provider or credential", async () => {
      const { provider } = await setupProviderWithCredential();
      const suspended = await callerKeyRepository.createCallerKey(
        {
          callerName: "SuspendedClient",
          environment: "development",
          scope: "subtitles:read",
          quotaPolicy: "default",
        },
        now,
      );
      await callerKeyRepository.suspendCallerKey(suspended.callerKey.id, now);

      await expect(
        searchSubtitles(
          makeRequest(suspended.key),
          { title: "Example" },
          { db: providerRepository["db"], now },
        ),
      ).rejects.toMatchObject<AppError>({
        code: "CALLER_KEY_SUSPENDED",
      });

      const persistedCredential = await directDb
        ?.select()
        .from(providerCredentials)
        .where(eq(providerCredentials.providerId, provider.id));

      expect(persistedCredential?.[0]?.status).toBe("active");
      expect(persistedCredential?.[0]?.lastErrorAt).toBeNull();

      const persistedProvider = await directDb
        ?.select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .then((rows) => rows[0]);

      expect(persistedProvider?.status).toBe("enabled");
      expect(persistedProvider?.lastHealthStatus).toBe("ready");

      const requests = await directDb
        ?.select()
        .from(subtitleSearchRequests)
        .where(eq(subtitleSearchRequests.status, "unauthorized"))
        .limit(5);

      expect(requests).toHaveLength(1);
      expect(requests?.[0]).toMatchObject({
        callerKeyId: null,
        status: "unauthorized",
        providerId: null,
        credentialId: null,
        resultCount: 0,
      });
    });
  },
);
