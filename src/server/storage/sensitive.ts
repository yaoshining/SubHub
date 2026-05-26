const sensitiveValuePatterns = [
  /password/i,
  /session[\s_-]*token/i,
  /caller[\s_-]*key/i,
  /provider[\s_-]*(api[\s_-]*)?(key|token|secret|credential)/i,
  /reveal[\s_-]*token/i,
  /encryption[\s_-]*key/i,
];

export const sensitiveStorageColumns = [
  'password_hash',
  'session_token_hash',
  'secret_hash',
  'secret_encrypted',
  'key_hash',
  'reveal_token_hash',
] as const;

export const forbiddenPlaintextStorageColumns = [
  'password',
  'session_token',
  'secret',
  'api_key',
  'provider_api_key',
  'caller_key',
  'key_plaintext',
  'reveal_token',
  'encryption_key',
] as const;

export function assertNoForbiddenPlaintextStorageColumns(columns: readonly string[]): void {
  const forbidden = columns.filter((column) =>
    forbiddenPlaintextStorageColumns.includes(column.toLowerCase() as (typeof forbiddenPlaintextStorageColumns)[number]),
  );

  if (forbidden.length > 0) {
    throw new Error(`Forbidden plaintext storage columns: ${forbidden.join(', ')}`);
  }
}

export function containsSensitivePlaintext(value: string, secrets: readonly string[]): boolean {
  return secrets.some((secret) => secret.length > 0 && value.includes(secret));
}

export function redactSensitiveMessage(message: string): string {
  return message
    .split(/(\s+)/)
    .map((part) => (sensitiveValuePatterns.some((pattern) => pattern.test(part)) ? '[REDACTED]' : part))
    .join('');
}
