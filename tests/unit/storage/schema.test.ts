import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStorageClient, type StorageClient } from "../../../src/server/storage/client.js";

const coreTables = [
  "admin_users",
  "admin_invitations",
  "admin_sessions",
  "providers",
  "provider_credentials",
  "caller_keys",
  "caller_key_rotations",
  "subtitle_search_requests",
  "subtitle_download_requests",
  "admin_action_results",
];

const now = "2026-05-26T00:00:00.000Z";
let tempDir: string;
let client: StorageClient;

const insertAdminUser = (id = "admin_test") => {
  client.sqlite
    .prepare(
      `insert into admin_users (
        id, identifier, display_name, password_hash, status, role, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, `${id}@example.com`, "Test Admin", "password_hash", "active", "admin", now, now);
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-storage-"));
  client = createStorageClient({ sqlitePath: join(tempDir, "test.sqlite"), runMigrations: true });
});

afterEach(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("SQLite + Drizzle storage schema", () => {
  it("applies the initial migration and creates all core tables", () => {
    const tables = client.sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    for (const table of coreTables) {
      expect(tables).toContain(table);
    }
  });

  it("enforces unique admin identifiers and admin status constraints", () => {
    insertAdminUser("admin_unique");

    expect(() => insertAdminUser("admin_unique_duplicate")).not.toThrow();
    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_users (
            id, identifier, display_name, password_hash, status, role, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("admin_duplicate_identifier", "admin_unique@example.com", "Duplicate", "hash", "active", "admin", now, now);
    }).toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_users (
            id, identifier, display_name, password_hash, status, role, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("admin_invalid_status", "invalid@example.com", "Invalid", "hash", "locked", "admin", now, now);
    }).toThrow();
  });

  it("enforces foreign keys and session status constraints", () => {
    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_sessions (
            id, admin_user_id, session_token_hash, status, created_at, expires_at
          ) values (?, ?, ?, ?, ?, ?)`,
        )
        .run("session_missing_user", "missing_admin", "session_hash", "active", now, now);
    }).toThrow();

    insertAdminUser("admin_session_owner");

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_sessions (
            id, admin_user_id, session_token_hash, status, created_at, expires_at
          ) values (?, ?, ?, ?, ?, ?)`,
        )
        .run("session_invalid_status", "admin_session_owner", "session_hash", "risk", now, now);
    }).toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_sessions (
            id, admin_user_id, session_token_hash, status, created_at, expires_at
          ) values (?, ?, ?, ?, ?, ?)`,
        )
        .run("session_attention", "admin_session_owner", "session_hash_attention", "needs_attention", now, now);
    }).not.toThrow();
  });

  it("allows only one pending invitation per identifier while preserving history", () => {
    insertAdminUser("admin_inviter");

    const insertInvitation = client.sqlite.prepare(
      `insert into admin_invitations (
        id, identifier, status, role_preset, access_preset,
        invited_by_admin_user_id, expires_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertInvitation.run(
      "invite_pending_1",
      "operator@example.com",
      "pending",
      "operator",
      "admin_console",
      "admin_inviter",
      now,
      now,
      now,
    );

    expect(() => {
      insertInvitation.run(
        "invite_pending_2",
        "operator@example.com",
        "pending",
        "operator",
        "admin_console",
        "admin_inviter",
        now,
        now,
        now,
      );
    }).toThrow();

    expect(() => {
      insertInvitation.run(
        "invite_expired_history",
        "operator@example.com",
        "expired",
        "operator",
        "admin_console",
        "admin_inviter",
        now,
        now,
        now,
      );
    }).not.toThrow();
  });

  it("enforces provider credential uniqueness and status constraints", () => {
    client.sqlite
      .prepare(
        `insert into providers (
          id, name, type, status, priority, weight, concurrency_limit,
          rotation_enabled, cooldown_seconds, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("provider_1", "OpenSubtitles Primary", "opensubtitles", "needs_config", 100, 100, 1, 1, 60, now, now);

    const insertCredential = client.sqlite.prepare(
      `insert into provider_credentials (
        id, provider_id, label, secret_hash, secret_encrypted, status, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertCredential.run("cred_1", "provider_1", "primary", "secret_hash_1", "encrypted_secret", "active", now, now);

    expect(() => {
      insertCredential.run("cred_duplicate_label", "provider_1", "primary", "secret_hash_2", "encrypted_secret", "active", now, now);
    }).toThrow();

    expect(() => {
      insertCredential.run("cred_invalid_status", "provider_1", "backup", "secret_hash_3", "encrypted_secret", "pending", now, now);
    }).toThrow();
  });

  it("rolls back storage client transactions on failure", () => {
    expect(() => {
      client.transaction((db) => {
        db.run(
          `insert into admin_users (
            id, identifier, display_name, password_hash, status, role, created_at, updated_at
          ) values ('admin_tx', 'tx@example.com', 'Tx Admin', 'hash', 'active', 'admin', '${now}', '${now}')`,
        );
        throw new Error("rollback");
      });
    }).toThrow("rollback");

    const count = client.sqlite
      .prepare("select count(*) as count from admin_users where id = ?")
      .get("admin_tx") as { count: number };

    expect(count.count).toBe(0);
  });
});
