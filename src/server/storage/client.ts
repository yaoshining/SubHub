import { migrate } from "drizzle-orm/postgres-js/migrator";

import {
  createDirectPostgresClient,
  createRuntimePostgresClient,
  type PostgresDatabase,
  type PostgresClientOptions,
  resolvePostgresUrlBoundary,
} from "./postgres-client";

export type StorageDatabase = PostgresDatabase;

export type StorageClient = {
  db: StorageDatabase;
  sqlite?: undefined;
  runtimeUrl: string;
  directUrl: string;
  migrate: () => Promise<void>;
  transaction: <T>(
    callback: (db: StorageDatabase) => Promise<T> | T,
  ) => Promise<T>;
  close: () => Promise<void>;
};

export type StorageClientOptions = PostgresClientOptions;

const migrationsFolder = "src/server/storage/migrations";
let singleton: StorageClient | undefined;

export const resolveStorageDatabasePath = (databaseUrl?: string): string =>
  resolvePostgresUrlBoundary({ runtimeDatabaseUrl: databaseUrl }).runtimeUrl;

export const createStorageClient = (
  options: StorageClientOptions = {},
): StorageClient => {
  const { runtimeUrl, directUrl } = resolvePostgresUrlBoundary(options);
  const runtimeClient = createRuntimePostgresClient({
    runtimeDatabaseUrl: runtimeUrl,
  });
  let directClient: ReturnType<typeof createDirectPostgresClient> | undefined;

  const client: StorageClient = {
    db: runtimeClient.db as StorageDatabase,
    runtimeUrl,
    directUrl,
    migrate: async () => {
      if (!directClient) {
        directClient = createDirectPostgresClient({
          directDatabaseUrl: directUrl,
        });
      }

      await migrate(directClient.db, { migrationsFolder });
    },
    transaction: async (callback) =>
      runtimeClient.db.transaction(async (tx) =>
        callback(tx as StorageDatabase),
      ),
    close: async () => {
      await Promise.all([
        runtimeClient.close(),
        directClient ? directClient.close() : Promise.resolve(),
      ]);
    },
  };

  return client;
};

export const getStorageClient = (): StorageClient => {
  if (!singleton) {
    singleton = createStorageClient();
  }

  return singleton;
};

export const closeStorageClient = async () => {
  if (!singleton) {
    return;
  }

  await singleton.close();
  singleton = undefined;
};
