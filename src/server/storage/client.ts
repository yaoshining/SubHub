import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { schema } from './schema';
import { apply001MvpAdminConsoleMigration } from './migrations/001_mvp_admin_console';

export const defaultDatabasePath = process.env.SUBHUB_SQLITE_PATH ?? process.env.DATABASE_URL ?? './data/subhub.sqlite';

export type StorageDatabase = BetterSQLite3Database<typeof schema>;

export interface StorageClient {
  sqlite: Database.Database;
  db: StorageDatabase;
  migrate: () => void;
  transaction: <T>(callback: (db: StorageDatabase) => T) => T;
  close: () => void;
}

export interface CreateStorageClientOptions {
  path?: string;
  migrate?: boolean;
  readonly?: boolean;
}

export function createStorageClient(options: CreateStorageClientOptions = {}): StorageClient {
  const sqlite = new Database(options.path ?? defaultDatabasePath, {
    readonly: options.readonly ?? false,
  });
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite, { schema });

  const client: StorageClient = {
    sqlite,
    db,
    migrate: () => applyStorageMigrations(sqlite),
    transaction: (callback) => db.transaction((tx) => callback(tx as StorageDatabase)),
    close: () => sqlite.close(),
  };

  if (options.migrate ?? true) {
    client.migrate();
  }

  return client;
}

export function createTestStorageClient(path = ':memory:'): StorageClient {
  return createStorageClient({ path, migrate: true });
}

export function applyStorageMigrations(sqlite: Database.Database): void {
  apply001MvpAdminConsoleMigration(sqlite);
}

export function migrateDatabase(path = defaultDatabasePath): void {
  const client = createStorageClient({ path, migrate: false });
  try {
    client.migrate();
  } finally {
    client.close();
  }
}
