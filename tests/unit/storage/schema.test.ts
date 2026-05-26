import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { adminInvitations, adminSessions, adminUsers, providerCredentials, providers } from '../../../src/server/storage/schema';
import { createTestStorageClient, type StorageClient } from '../../../src/server/storage/client';

describe('SQLite + Drizzle storage schema', () => {
  let storage: StorageClient;

  beforeEach(() => {
    storage = createTestStorageClient();
  });

  afterEach(() => {
    storage.close();
  });

  it('applies the MVP migration and creates all core tables', () => {
    const tables = storage.sqlite
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual([
      'admin_action_results',
      'admin_invitations',
      'admin_sessions',
      'admin_users',
      'caller_key_rotations',
      'caller_keys',
      'provider_credentials',
      'providers',
      'subtitle_download_requests',
      'subtitle_search_requests',
    ]);
  });

  it('enables SQLite foreign key enforcement on every storage client', () => {
    const pragma = storage.sqlite.pragma('foreign_keys', { simple: true });

    expect(pragma).toBe(1);
    expect(() =>
      storage.db.insert(adminSessions).values({
        id: 'session_missing_user',
        adminUserId: 'admin_missing',
        sessionTokenHash: 'session_hash_missing_user',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '2026-05-27T00:00:00.000Z',
      }).run(),
    ).toThrow();
  });

  it('enforces unique login identifiers and session token hashes', () => {
    insertAdminUser(storage, 'admin_1', 'owner@example.com');

    expect(() => insertAdminUser(storage, 'admin_2', 'owner@example.com')).toThrow();

    storage.db.insert(adminSessions).values({
      id: 'session_1',
      adminUserId: 'admin_1',
      sessionTokenHash: 'hash_session_token',
      status: 'active',
      createdAt: '2026-05-26T00:00:00.000Z',
      expiresAt: '2026-05-27T00:00:00.000Z',
    }).run();

    expect(() =>
      storage.db.insert(adminSessions).values({
        id: 'session_2',
        adminUserId: 'admin_1',
        sessionTokenHash: 'hash_session_token',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '2026-05-27T00:00:00.000Z',
      }).run(),
    ).toThrow();
  });

  it('enforces the partial unique index for pending invitations only', () => {
    insertAdminUser(storage, 'admin_1', 'owner@example.com');

    insertInvitation(storage, 'invite_1', 'new@example.com', 'pending');
    expect(() => insertInvitation(storage, 'invite_2', 'new@example.com', 'pending')).toThrow();

    insertInvitation(storage, 'invite_3', 'new@example.com', 'expired');
    insertInvitation(storage, 'invite_4', 'new@example.com', 'revoked');
  });

  it('enforces status checks for invitations and sessions', () => {
    insertAdminUser(storage, 'admin_1', 'owner@example.com');

    expect(() => insertInvitation(storage, 'invite_1', 'new@example.com', 'draft')).toThrow();
    expect(() =>
      storage.db.insert(adminSessions).values({
        id: 'session_1',
        adminUserId: 'admin_1',
        sessionTokenHash: 'hash_session_token',
        status: 'risk',
        createdAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '2026-05-27T00:00:00.000Z',
      }).run(),
    ).toThrow();
  });

  it('enforces provider and credential uniqueness for scheduling safety', () => {
    storage.db.insert(providers).values({
      id: 'provider_1',
      name: 'OpenSubtitles Primary',
      type: 'opensubtitles',
      status: 'enabled',
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
    }).run();

    expect(() =>
      storage.db.insert(providers).values({
        id: 'provider_2',
        name: 'OpenSubtitles Primary',
        type: 'opensubtitles',
        status: 'enabled',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run(),
    ).toThrow();

    storage.db.insert(providerCredentials).values({
      id: 'cred_1',
      providerId: 'provider_1',
      label: 'primary',
      secretHash: 'hash_provider_secret',
      secretEncrypted: 'encrypted_provider_secret',
      status: 'active',
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
    }).run();

    expect(() =>
      storage.db.insert(providerCredentials).values({
        id: 'cred_2',
        providerId: 'provider_1',
        label: 'primary',
        secretHash: 'hash_other_provider_secret',
        secretEncrypted: 'encrypted_other_provider_secret',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run(),
    ).toThrow();

    expect(() =>
      storage.db.insert(providerCredentials).values({
        id: 'cred_3',
        providerId: 'provider_1',
        label: 'backup',
        secretHash: 'hash_provider_secret',
        secretEncrypted: 'encrypted_provider_secret_again',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run(),
    ).toThrow();
  });

  it('keeps query indexes required by database-design.md', () => {
    const indexes = storage.sqlite
      .prepare("select name from sqlite_master where type = 'index' and name not like 'sqlite_%'")
      .all()
      .map((row: any) => row.name);

    expect(indexes).toEqual(expect.arrayContaining([
      'admin_sessions_user_status_idx',
      'admin_sessions_status_last_seen_idx',
      'providers_type_status_idx',
      'providers_status_priority_idx',
      'provider_credentials_provider_status_cooldown_idx',
      'caller_keys_status_environment_idx',
      'subtitle_search_requests_status_created_idx',
      'subtitle_download_requests_status_created_idx',
      'admin_action_results_target_created_idx',
    ]));
  });

  it('uses explicit text IDs and ISO text timestamps instead of SQLite rowid contracts', () => {
    const tableInfo = storage.sqlite.prepare('pragma table_info(admin_users)').all() as Array<{ name: string; type: string; pk: number }>;
    const idColumn = tableInfo.find((column) => column.name === 'id');
    const createdAtColumn = tableInfo.find((column) => column.name === 'created_at');

    expect(idColumn).toMatchObject({ type: 'TEXT', pk: 1 });
    expect(createdAtColumn).toMatchObject({ type: 'TEXT' });

    const schemaSql = storage.sqlite
      .prepare("select sql from sqlite_master where type = 'table' and name = 'admin_users'")
      .get() as { sql: string };

    expect(schemaSql.sql.toLowerCase()).not.toContain('autoincrement');
  });

  it('runs application code inside the shared transaction wrapper', () => {
    storage.transaction((db) => {
      db.insert(adminUsers).values({
        id: 'admin_1',
        identifier: 'owner@example.com',
        displayName: 'Owner',
        passwordHash: 'hash_password',
        status: 'active',
        role: 'admin',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run();
    });

    const count = storage.db.select({ count: sql<number>`count(*)` }).from(adminUsers).get();
    expect(count?.count).toBe(1);
  });
});

function insertAdminUser(storage: StorageClient, id: string, identifier: string): void {
  storage.db.insert(adminUsers).values({
    id,
    identifier,
    displayName: 'Owner',
    passwordHash: `hash_${id}`,
    status: 'active',
    role: 'admin',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  }).run();
}

function insertInvitation(storage: StorageClient, id: string, identifier: string, status: string): void {
  storage.db.insert(adminInvitations).values({
    id,
    identifier,
    status,
    rolePreset: 'operator',
    accessPreset: 'admin_console',
    invitedByAdminUserId: 'admin_1',
    expiresAt: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  }).run();
}
