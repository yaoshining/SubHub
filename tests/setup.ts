import "@testing-library/jest-dom/vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

let testDatabaseDirectory: string | undefined;

const createMemoryStorage = () => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } satisfies Storage;
};

const localStorageMock = createMemoryStorage();
const sessionStorageMock = createMemoryStorage();

beforeAll(() => {
  testDatabaseDirectory = mkdtempSync(join(tmpdir(), "subhub-test-db-"));

  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: sessionStorageMock,
  });

  Object.assign(process.env, {
    NODE_ENV: process.env.NODE_ENV ?? "test",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
    DATABASE_URL: process.env.DATABASE_URL ?? "test-database-url",
    DATABASE_URL_UNPOOLED:
      process.env.DATABASE_URL_UNPOOLED ?? "test-database-url-unpooled",
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
      process.env.CALLER_KEY_SECRET ?? "test-caller-key-secret-at-least-32",
  });
});

afterEach(() => {
  cleanup();
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  if (testDatabaseDirectory && existsSync(testDatabaseDirectory)) {
    rmSync(testDatabaseDirectory, { recursive: true, force: true });
  }
});
