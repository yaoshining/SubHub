export const mvpAdminConsoleMigration = {
  id: "001_mvp_admin_console",
  sqlFile: "001_mvp_admin_console.sql",
  generatedBy:
    "drizzle-kit generate --name 001_mvp_admin_console --prefix none",
  covers: [
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
  ],
} as const;
