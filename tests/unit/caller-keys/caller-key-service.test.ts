import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requireCallerKey } from "@/server/api/caller-key-auth";
import {
  createCallerKey,
  listCallerKeys,
  rotateCallerKey,
  suspendCallerKey,
} from "@/server/services/caller-key-service";
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
});
