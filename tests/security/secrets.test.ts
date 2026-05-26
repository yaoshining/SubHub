import { describe, expect, it } from 'vitest';

import { adminActionResultsTable, adminSessions, adminUsers, callerKeys, providerCredentials, providers } from '../../src/server/storage/schema';
import { assertNoForbiddenPlaintextStorageColumns, containsSensitivePlaintext, redactSensitiveMessage } from '../../src/server/storage/sensitive';
import { createTestStorageClient } from '../../src/server/storage/client';

describe('storage sensitive data boundaries', () => {
  it('does not define plaintext secret columns in the persisted schema', () => {
    const storage = createTestStorageClient();
    try {
      const columns = storage.sqlite
        .prepare(`select name from pragma_table_info('admin_users')
          union all select name from pragma_table_info('admin_sessions')
          union all select name from pragma_table_info('provider_credentials')
          union all select name from pragma_table_info('caller_keys')`)
        .all()
        .map((row: any) => row.name);

      expect(() => assertNoForbiddenPlaintextStorageColumns(columns)).not.toThrow();
      expect(columns).toEqual(expect.arrayContaining([
        'password_hash',
        'session_token_hash',
        'secret_hash',
        'secret_encrypted',
        'key_hash',
        'reveal_token_hash',
      ]));
    } finally {
      storage.close();
    }
  });

  it('persists only hashes or encrypted forms for password, session, provider credential and caller key data', () => {
    const storage = createTestStorageClient();
    const plaintext = {
      password: 'CorrectHorseBatteryStaple!',
      sessionToken: 'session_token_plaintext',
      providerSecret: 'opensubtitles_provider_secret',
      callerKey: 'subhub_caller_key_plaintext',
      revealToken: 'reveal_token_plaintext',
    };

    try {
      storage.db.insert(adminUsers).values({
        id: 'admin_1',
        identifier: 'owner@example.com',
        displayName: 'Owner',
        passwordHash: 'argon2id$hash_password',
        status: 'active',
        role: 'admin',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run();
      storage.db.insert(adminSessions).values({
        id: 'session_1',
        adminUserId: 'admin_1',
        sessionTokenHash: 'sha256$hash_session_token',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        expiresAt: '2026-05-27T00:00:00.000Z',
      }).run();
      storage.db.insert(providers).values({
        id: 'provider_1',
        name: 'OpenSubtitles Primary',
        type: 'opensubtitles',
        status: 'enabled',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run();
      storage.db.insert(providerCredentials).values({
        id: 'cred_1',
        providerId: 'provider_1',
        label: 'primary',
        secretHash: 'sha256$hash_provider_secret',
        secretEncrypted: 'v1:encrypted_provider_secret',
        displayPrefix: 'open',
        displaySuffix: 'cret',
        status: 'active',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run();
      storage.db.insert(callerKeys).values({
        id: 'ck_1',
        callerName: 'Infuse',
        environment: 'production',
        scope: 'subtitles:read',
        quotaPolicy: 'default',
        keyHash: 'sha256$hash_caller_key',
        keyPrefix: 'subh',
        keySuffix: 'text',
        status: 'active',
        revealUntil: '2026-05-26T00:10:00.000Z',
        revealTokenHash: 'sha256$hash_reveal_token',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      }).run();

      const dump = JSON.stringify([
        storage.db.select().from(adminUsers).all(),
        storage.db.select().from(adminSessions).all(),
        storage.db.select().from(providerCredentials).all(),
        storage.db.select().from(callerKeys).all(),
      ]);

      expect(containsSensitivePlaintext(dump, Object.values(plaintext))).toBe(false);
    } finally {
      storage.close();
    }
  });

  it('keeps admin action messages free of known secret plaintext before insert', () => {
    const storage = createTestStorageClient();
    const unsafeMessage = 'caller_key subhub_caller_key_plaintext rotated with provider secret opensubtitles_provider_secret';
    const safeMessage = redactSensitiveMessage(unsafeMessage);

    try {
      storage.db.insert(adminActionResultsTable).values({
        id: 'aar_1',
        actionType: 'caller_key_rotated',
        targetType: 'caller_key',
        targetId: 'ck_1',
        result: 'success',
        message: safeMessage,
        createdAt: '2026-05-26T00:00:00.000Z',
      }).run();

      const rows = storage.db.select().from(adminActionResultsTable).all();
      const dump = JSON.stringify(rows);

      expect(dump).not.toContain('subhub_caller_key_plaintext');
      expect(dump).not.toContain('opensubtitles_provider_secret');
    } finally {
      storage.close();
    }
  });
});
