export const providerAdminBaselineMigration = {
  id: "003_provider_admin_baseline",
  sqlFile: "003_provider_admin_baseline.sql",
  generatedBy: "手写 SQL（与 002 模式一致，精确控制 DDL 顺序）",
  covers: ["providers"],
} as const;
