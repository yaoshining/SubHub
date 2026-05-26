import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.APP_URL = process.env.APP_URL ?? "http://localhost:3000";
process.env.SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH ?? ":memory:";
process.env.OPENSUBTITLES_API_URL = process.env.OPENSUBTITLES_API_URL ?? "https://api.opensubtitles.com/api/v1";
process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ?? "test-provider-credential-key-32-byte";
process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? "test-admin-session-secret-32-byte";
process.env.CALLER_KEY_SECRET = process.env.CALLER_KEY_SECRET ?? "test-caller-key-secret-32-byte";
