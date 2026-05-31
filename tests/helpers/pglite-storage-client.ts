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
      "PGlite test storage 尚未初始化，请先调用 initializePGliteStorageForTesting().",
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
    await closePGliteStorageForTesting();
  },
});

export const initializePGliteStorageForTesting = async (
  storageLabel: string,
) => {
  await closePGliteStorageForTesting();

  currentHarness = await createPGliteTestHarness();
  currentStorageClient = buildStorageClient(currentHarness, storageLabel);

  return currentStorageClient;
};

export const getStorageClient = () => requireStorageClient();

export const closePGliteStorageForTesting = async () => {
  if (currentHarness) {
    await currentHarness.close();
  }

  currentHarness = undefined;
  currentStorageClient = undefined;
};

export const resetPGliteStorageForTesting = async () => {
  await closePGliteStorageForTesting();
};

vi.mock("@/server/storage/client", async () => {
  const actual = await vi.importActual<typeof import("@/server/storage/client")>(
    "@/server/storage/client",
  );

  return {
    ...actual,
    createStorageClient: () => requireStorageClient(),
    getStorageClient,
    closeStorageClient: closePGliteStorageForTesting,
  };
});