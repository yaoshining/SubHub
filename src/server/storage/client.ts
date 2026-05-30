import { dirname, isAbsolute, resolve } from "node:path";
import { mkdirSync } from "node:fs";

import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { schema } from "./schema";

export type StorageDatabase = BetterSQLite3Database<typeof schema>;

export type StorageClient = {
  db: StorageDatabase;
  sqlite: Database.Database;
  path: string;
  migrate: () => void;
  transaction: <T>(callback: (db: StorageDatabase) => T) => T;
  close: () => void;
};

export type StorageClientOptions = {
  sqlitePath?: string;
  runMigrations?: boolean;
  readonly?: boolean;
};

const migrationsFolder = "src/server/storage/migrations";
let singleton: StorageClient | undefined;
let testDatabasePath: string | undefined;

const normalizeSqlitePath = (databasePath: string): string => {
  const withoutFileScheme = databasePath.startsWith("file:")
    ? databasePath.slice("file:".length)
    : databasePath;

  if (withoutFileScheme === ":memory:") {
    return withoutFileScheme;
  }

  return isAbsolute(withoutFileScheme)
    ? withoutFileScheme
    : resolve(process.cwd(), withoutFileScheme);
};

const ensureDatabaseDirectory = (databasePath: string) => {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
};

export const resolveStorageDatabasePath = (sqlitePath?: string): string => {
  const configuredPath =
    sqlitePath ??
    testDatabasePath ??
    process.env.SQLITE_DATABASE_PATH ??
    process.env.SUBHUB_SQLITE_PATH ??
    process.env.SUBHUB_DATABASE_URL ??
    ".subhub/subhub.sqlite";

  return normalizeSqlitePath(configuredPath);
};

export const createStorageClient = (
  options: StorageClientOptions = {},
): StorageClient => {
  const databasePath = resolveStorageDatabasePath(options.sqlitePath);
  ensureDatabaseDirectory(databasePath);

  const sqlite = new Database(databasePath, {
    readonly: options.readonly ?? false,
  });

  sqlite.pragma("foreign_keys = ON");

  if (databasePath !== ":memory:" && !(options.readonly ?? false)) {
    sqlite.pragma("journal_mode = WAL");
  }

  const db = drizzle(sqlite, { schema });

  const client: StorageClient = {
    db,
    sqlite,
    path: databasePath,
    migrate: () => {
      sqlite.pragma("foreign_keys = ON");
      migrate(db, { migrationsFolder });
    },
    transaction: (callback) =>
      db.transaction((tx) => callback(tx as StorageDatabase)),
    close: () => sqlite.close(),
  };

  const shouldRunMigrations =
    options.runMigrations ?? !(options.readonly ?? false);

  if (shouldRunMigrations) {
    client.migrate();
  }

  return client;
};

export const getStorageClient = (): StorageClient => {
  if (!singleton) {
    singleton = createStorageClient();
  }

  return singleton;
};

export const closeStorageClient = () => {
  singleton?.close();
  singleton = undefined;
};

export const setStorageDatabasePathForTesting = (sqlitePath: string) => {
  closeStorageClient();
  testDatabasePath = sqlitePath;
};

export const resetStorageDatabasePathForTesting = () => {
  closeStorageClient();
  testDatabasePath = undefined;
};
