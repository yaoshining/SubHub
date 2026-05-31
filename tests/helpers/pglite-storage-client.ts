import type { StorageClient, StorageDatabase } from "@/server/storage/client";

import { vi } from "vitest";

import {
  createPGliteTestHarness,
  type PGliteTestHarness,
} from "./pglite-storage";

let currentHarness: PGliteTestHarness | undefined;
let currentStorageClient: StorageClient | undefined;

const requireStorageClient = (): StorageClient => {
  if (!currentStorageClient) {
    throw new Error(
      "PGlite test storage 尚未初始化，请先调用 setStorageDatabasePathForTesting().",
    );
  }

  return currentStorageClient;
};

const buildStorageClient = (
  harness: PGliteTestHarness,
  databasePathLabel: string,
): StorageClient => ({
  db: harness.db as StorageDatabase,
  runtimeUrl: `pglite:${databasePathLabel}`,
  directUrl: `pglite:${databasePathLabel}`,
  migrate: async () => undefined,
  transaction: async (callback) =>
    (harness.db as {
      transaction: <T>(runner: (tx: unknown) => Promise<T> | T) => Promise<T>;
    }).transaction(async (tx) => callback(tx as StorageDatabase)),
  close: async () => {
    await closeStorageClient();
  },
});

export const setStorageDatabasePathForTesting = async (
  databasePath: string,
) => {
  await closeStorageClient();

  currentHarness = await createPGliteTestHarness();
  currentStorageClient = buildStorageClient(currentHarness, databasePath);

  return currentStorageClient;
};

export const getStorageClient = () => requireStorageClient();

export const closeStorageClient = async () => {
  if (currentHarness) {
    await currentHarness.close();
  }

  currentHarness = undefined;
  currentStorageClient = undefined;
};

export const resetStorageDatabasePathForTesting = async () => {
  await closeStorageClient();
};

vi.mock("@/server/storage/client", async () => {
  const actual = await vi.importActual<typeof import("@/server/storage/client")>(
    "@/server/storage/client",
  );

  return {
    ...actual,
    createStorageClient: () => requireStorageClient(),
    getStorageClient,
    closeStorageClient,
  };
});