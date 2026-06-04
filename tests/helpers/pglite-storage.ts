import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { StorageDatabase } from "@/server/storage/client";
import { schema } from "@/server/storage/schema";

const migrationsFolder = "src/server/storage/migrations";

export type PGliteTestHarness = {
  client: PGlite;
  db: StorageDatabase;
  close: () => Promise<void>;
};

export const createPGliteTestHarness = async (): Promise<PGliteTestHarness> => {
  const client = new PGlite();

  await client.waitReady;

  const db = drizzle({ client, schema }) as unknown as StorageDatabase;

  await migrate(db as never, { migrationsFolder });

  return {
    client,
    db,
    close: () => client.close(),
  };
};
