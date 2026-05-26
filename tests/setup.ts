import "@testing-library/jest-dom/vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

let testDatabaseDirectory: string | undefined;

beforeAll(() => {
  testDatabaseDirectory = mkdtempSync(join(tmpdir(), "subhub-test-db-"));
  Object.assign(process.env, {
    NODE_ENV: process.env.NODE_ENV ?? "test",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
    SQLITE_DATABASE_PATH: join(testDatabaseDirectory, "subhub-test.sqlite"),
    OPENSUBTITLES_API_URL:
      process.env.OPENSUBTITLES_API_URL ??
      "https://api.opensubtitles.com/api/v1",
    PROVIDER_CREDENTIAL_ENCRYPTION_KEY:
      process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ??
      "test-provider-credential-key-32-byte",
    ADMIN_SESSION_SECRET:
      process.env.ADMIN_SESSION_SECRET ?? "test-admin-session-secret-32-byte",
    CALLER_KEY_SECRET:
      process.env.CALLER_KEY_SECRET ?? "test-caller-key-secret-32-byte",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  if (testDatabaseDirectory && existsSync(testDatabaseDirectory)) {
    rmSync(testDatabaseDirectory, { recursive: true, force: true });
  }
});
