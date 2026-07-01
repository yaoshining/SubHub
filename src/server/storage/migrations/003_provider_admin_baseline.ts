export const providerAdminBaselineMigration = {
  id: "003_provider_admin_baseline",
  sqlFile: "003_provider_admin_baseline.sql",
  generatedBy: "hand-written — CHECK constraint drop/recreate + xunlei insert + last_health_checked_at column",
  covers: [
    "providers",
  ],
} as const;
