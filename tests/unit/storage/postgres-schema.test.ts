import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  adminInvitations,
  adminSessions,
  adminUsers,
  callerKeyRotations,
  providerCredentials,
  providers,
} from "../../../src/server/storage/schema.js";
import { neonVercelBaselineMigration } from "../../../src/server/storage/migrations/002_neon_vercel_baseline.js";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "src/server/storage/migrations/002_neon_vercel_baseline.sql",
  ),
  "utf8",
);

describe("Postgres storage schema baseline", () => {
  it("keeps Postgres baseline metadata independent from SQLite history", () => {
    expect(neonVercelBaselineMigration.id).toBe("002_neon_vercel_baseline");
    expect(neonVercelBaselineMigration.sqlFile).toBe(
      "002_neon_vercel_baseline.sql",
    );
    expect(neonVercelBaselineMigration.generatedBy).toContain(
      "002_neon_vercel_baseline",
    );
  });

  it("maps runtime timestamps to timestamptz and booleans to native boolean", () => {
    const providerColumns = getTableConfig(providers).columns;
    const adminUserColumns = getTableConfig(adminUsers).columns;

    expect(
      providerColumns.find((column) => column.name === "rotation_enabled")
        ?.columnType,
    ).toBe("PgBoolean");
    expect(
      providerColumns.find((column) => column.name === "created_at")
        ?.columnType,
    ).toBe("PgTimestampString");
    expect(
      adminUserColumns.find((column) => column.name === "last_login_at")
        ?.columnType,
    ).toBe("PgTimestampString");
  });

  it("retains pending invitation partial unique index and foreign keys", () => {
    const invitationConfig = getTableConfig(adminInvitations);

    expect(
      invitationConfig.indexes.some(
        (index) =>
          index.config.name === "admin_invitations_pending_identifier_unique" &&
          Boolean(index.config.where),
      ),
    ).toBe(true);
    expect(
      invitationConfig.foreignKeys.map((foreignKey) => foreignKey.getName()),
    ).toEqual(
      expect.arrayContaining([
        "admin_invitations_invited_by_admin_user_id_fk",
        "admin_invitations_accepted_admin_user_id_fk",
      ]),
    );
  });

  it("retains core unique indexes and foreign keys in baseline SQL", () => {
    expect(migrationSql).toContain("timestamp with time zone");
    expect(migrationSql).toContain('"rotation_enabled" boolean DEFAULT true');
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "admin_invitations_pending_identifier_unique"',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_fk"',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "caller_key_rotations" ADD CONSTRAINT "caller_key_rotations_caller_key_id_fk"',
    );
  });

  it("keeps provider credential and session query indexes for Postgres", () => {
    const providerCredentialIndexes =
      getTableConfig(providerCredentials).indexes;
    const adminSessionIndexes = getTableConfig(adminSessions).indexes;
    const rotationForeignKeys = getTableConfig(callerKeyRotations).foreignKeys;

    expect(providerCredentialIndexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "provider_credentials_provider_id_status_idx",
        "provider_credentials_provider_id_status_cooldown_until_idx",
      ]),
    );
    expect(adminSessionIndexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "admin_sessions_admin_user_id_status_idx",
        "admin_sessions_expires_at_idx",
      ]),
    );
    expect(
      rotationForeignKeys.map((foreignKey) => foreignKey.getName()),
    ).toEqual(
      expect.arrayContaining([
        "caller_key_rotations_caller_key_id_fk",
        "caller_key_rotations_performed_by_admin_user_id_fk",
      ]),
    );
  });
});
