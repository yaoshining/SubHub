import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createStorageClient,
  type StorageClient,
} from "../../../src/server/storage/client.js";

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
    .run(
      id,
      `${id}@example.com`,
      "Test Admin",
      "password_hash",
      "active",
      "admin",
      now,
      now,
    );
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-storage-"));
  client = createStorageClient({
    sqlitePath: join(tempDir, "test.sqlite"),
    runMigrations: true,
  });
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
        .run(
          "admin_duplicate_identifier",
          "admin_unique@example.com",
          "Duplicate",
          "hash",
          "active",
          "admin",
          now,
          now,
        );
    }).toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_users (
            id, identifier, display_name, password_hash, status, role, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "admin_invalid_status",
          "invalid@example.com",
          "Invalid",
          "hash",
          "locked",
          "admin",
          now,
          now,
        );
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
        .run(
          "session_missing_user",
          "missing_admin",
          "session_hash",
          "active",
          now,
          now,
        );
    }).toThrow();

    insertAdminUser("admin_session_owner");

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_sessions (
            id, admin_user_id, session_token_hash, status, created_at, expires_at
          ) values (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "session_invalid_status",
          "admin_session_owner",
          "session_hash",
          "risk",
          now,
          now,
        );
    }).toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into admin_sessions (
            id, admin_user_id, session_token_hash, status, created_at, expires_at
          ) values (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "session_attention",
          "admin_session_owner",
          "session_hash_attention",
          "needs_attention",
          now,
          now,
        );
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
      .run(
        "provider_1",
        "OpenSubtitles Primary",
        "opensubtitles",
        "needs_config",
        100,
        100,
        1,
        1,
        60,
        now,
        now,
      );

    const insertCredential = client.sqlite.prepare(
      `insert into provider_credentials (
        id, provider_id, label, secret_hash, secret_encrypted, status, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertCredential.run(
      "cred_1",
      "provider_1",
      "primary",
      "secret_hash_1",
      "encrypted_secret",
      "active",
      now,
      now,
    );

    expect(() => {
      insertCredential.run(
        "cred_duplicate_label",
        "provider_1",
        "primary",
        "secret_hash_2",
        "encrypted_secret",
        "active",
        now,
        now,
      );
    }).toThrow();

    expect(() => {
      insertCredential.run(
        "cred_invalid_status",
        "provider_1",
        "backup",
        "secret_hash_3",
        "encrypted_secret",
        "pending",
        now,
        now,
      );
    }).toThrow();
  });

  it("enforces caller key uniqueness, status and scope constraints", () => {
    const insertCallerKey = client.sqlite.prepare(
      `insert into caller_keys (
        id, caller_name, environment, scope, quota_policy, key_hash, status, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertCallerKey.run(
      "ck_1",
      "Jellyfin Home",
      "production",
      "subtitles:read",
      "default",
      "caller_key_hash_1",
      "active",
      now,
      now,
    );

    expect(() => {
      insertCallerKey.run(
        "ck_duplicate_hash",
        "Duplicate",
        "production",
        "subtitles:read",
        "default",
        "caller_key_hash_1",
        "active",
        now,
        now,
      );
    }).toThrow();

    expect(() => {
      insertCallerKey.run(
        "ck_invalid_scope",
        "Invalid Scope",
        "production",
        "admin:write",
        "default",
        "caller_key_hash_2",
        "active",
        now,
        now,
      );
    }).toThrow();

    expect(() => {
      insertCallerKey.run(
        "ck_invalid_status",
        "Invalid Status",
        "production",
        "subtitles:read",
        "default",
        "caller_key_hash_3",
        "pending",
        now,
        now,
      );
    }).toThrow();
  });

  it("enforces caller key rotation foreign keys and result constraints", () => {
    insertAdminUser("admin_rotation_actor");
    client.sqlite
      .prepare(
        `insert into caller_keys (
          id, caller_name, environment, scope, quota_policy, key_hash, status, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "ck_rotation",
        "Jellyfin Home",
        "production",
        "subtitles:read",
        "default",
        "hash_rotation",
        "active",
        now,
        now,
      );

    const insertRotation = client.sqlite.prepare(
      `insert into caller_key_rotations (
        id, caller_key_id, old_key_suffix, new_key_suffix, result, created_at, performed_by_admin_user_id
      ) values (?, ?, ?, ?, ?, ?, ?)`,
    );

    expect(() => {
      insertRotation.run(
        "ckr_1",
        "ck_rotation",
        "old",
        "new",
        "success",
        now,
        "admin_rotation_actor",
      );
    }).not.toThrow();

    expect(() => {
      insertRotation.run(
        "ckr_missing_key",
        "missing_key",
        "old",
        "new",
        "success",
        now,
        "admin_rotation_actor",
      );
    }).toThrow();

    expect(() => {
      insertRotation.run(
        "ckr_invalid_result",
        "ck_rotation",
        "old",
        "new",
        "partial",
        now,
        "admin_rotation_actor",
      );
    }).toThrow();
  });

  it("enforces subtitle request status constraints and references", () => {
    client.sqlite
      .prepare(
        `insert into caller_keys (
          id, caller_name, environment, scope, quota_policy, key_hash, status, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "ck_subtitles",
        "Jellyfin Home",
        "production",
        "subtitles:read",
        "default",
        "hash_subtitles",
        "active",
        now,
        now,
      );
    client.sqlite
      .prepare(
        `insert into providers (
          id, name, type, status, priority, weight, concurrency_limit,
          rotation_enabled, cooldown_seconds, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "provider_subtitles",
        "OpenSubtitles Search",
        "opensubtitles",
        "enabled",
        100,
        100,
        1,
        1,
        60,
        now,
        now,
      );
    client.sqlite
      .prepare(
        `insert into provider_credentials (
          id, provider_id, label, secret_hash, secret_encrypted, status, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "cred_subtitles",
        "provider_subtitles",
        "primary",
        "secret_hash_subtitles",
        "encrypted_secret",
        "active",
        now,
        now,
      );

    expect(() => {
      client.sqlite
        .prepare(
          `insert into subtitle_search_requests (
            id, caller_key_id, media_title, status, result_count, provider_id, credential_id, created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "search_1",
          "ck_subtitles",
          "Example",
          "no_results",
          0,
          "provider_subtitles",
          "cred_subtitles",
          now,
        );
    }).not.toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into subtitle_search_requests (
            id, caller_key_id, media_title, status, result_count, provider_id, credential_id, created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "search_invalid",
          "ck_subtitles",
          "Example",
          "timeout",
          0,
          "provider_subtitles",
          "cred_subtitles",
          now,
        );
    }).toThrow();

    expect(() => {
      client.sqlite
        .prepare(
          `insert into subtitle_download_requests (
            id, caller_key_id, subtitle_ref, status, provider_id, credential_id, created_at
          ) values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "download_missing_credential",
          "ck_subtitles",
          "subtitle_ref",
          "success",
          "provider_subtitles",
          "missing_credential",
          now,
        );
    }).toThrow();
  });

  it("enforces admin action result action, target and result constraints", () => {
    insertAdminUser("admin_action_actor");

    const insertAction = client.sqlite.prepare(
      `insert into admin_action_results (
        id, actor_admin_user_id, action_type, target_type, target_id, result, message, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    expect(() => {
      insertAction.run(
        "aar_1",
        "admin_action_actor",
        "credential_disabled",
        "provider_credential",
        "cred_1",
        "success",
        "Credential disabled",
        now,
      );
    }).not.toThrow();

    expect(() => {
      insertAction.run(
        "aar_invalid_action",
        "admin_action_actor",
        "permission_matrix_exported",
        "provider",
        "provider_1",
        "success",
        "Invalid action",
        now,
      );
    }).toThrow();

    expect(() => {
      insertAction.run(
        "aar_invalid_result",
        "admin_action_actor",
        "provider_enabled",
        "provider",
        "provider_1",
        "partial",
        "Invalid result",
        now,
      );
    }).toThrow();
  });

  it("keeps sensitive persisted fields hashed or encrypted without plaintext columns", () => {
    const columnsByTable = Object.fromEntries(
      [
        "admin_users",
        "admin_sessions",
        "provider_credentials",
        "caller_keys",
      ].map((tableName) => [
        tableName,
        client.sqlite
          .prepare(`pragma table_info(${tableName})`)
          .all()
          .map((row) => (row as { name: string }).name),
      ]),
    ) as Record<string, string[]>;

    expect(columnsByTable.admin_users).toContain("password_hash");
    expect(columnsByTable.admin_users).not.toContain("password");
    expect(columnsByTable.admin_sessions).toContain("session_token_hash");
    expect(columnsByTable.admin_sessions).not.toContain("session_token");
    expect(columnsByTable.provider_credentials).toEqual(
      expect.arrayContaining([
        "secret_hash",
        "secret_encrypted",
        "display_prefix",
        "display_suffix",
      ]),
    );
    expect(columnsByTable.provider_credentials).not.toContain("secret");
    expect(columnsByTable.caller_keys).toEqual(
      expect.arrayContaining([
        "key_hash",
        "key_prefix",
        "key_suffix",
        "reveal_token_hash",
      ]),
    );
    expect(columnsByTable.caller_keys).not.toContain("key");
  });

  it("creates query-driven indexes required by the database design", () => {
    const getIndexColumns = (indexName: string) =>
      client.sqlite
        .prepare(`pragma index_info(${indexName})`)
        .all()
        .map((row) => (row as { name: string }).name);

    const expectIndex = (
      tableName: string,
      indexName: string,
      columns: string[],
    ) => {
      const indexes = client.sqlite
        .prepare(`pragma index_list(${tableName})`)
        .all()
        .map((row) => (row as { name: string }).name);

      expect(indexes).toContain(indexName);
      expect(getIndexColumns(indexName)).toEqual(columns);
    };

    expectIndex("admin_sessions", "admin_sessions_admin_user_id_status_idx", [
      "admin_user_id",
      "status",
    ]);
    expectIndex(
      "provider_credentials",
      "provider_credentials_provider_id_status_cooldown_until_idx",
      ["provider_id", "status", "cooldown_until"],
    );
    expectIndex("caller_keys", "caller_keys_status_environment_idx", [
      "status",
      "environment",
    ]);
    expectIndex(
      "subtitle_search_requests",
      "subtitle_search_requests_status_created_at_idx",
      ["status", "created_at"],
    );
    expectIndex(
      "admin_action_results",
      "admin_action_results_target_type_target_id_created_at_idx",
      ["target_type", "target_id", "created_at"],
    );
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
