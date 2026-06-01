import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

describe("非生产运行环境 smoke", () => {
  it("staging Preview 与本地 development 都能解析出单一 URL 对", () => {
    const stagingPreview = readEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-subhub-example.vercel.app",
      VERCEL_GIT_COMMIT_REF: "preview",
      DATABASE_URL: "staging-pooled-url",
      DATABASE_URL_UNPOOLED: "staging-direct-url",
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY:
        "provider-credential-secret-at-least-32",
      ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
      CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
    });
    const localDevelopment = readEnv({
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      DEV_DATABASE_URL: "dev-pooled-url",
      DEV_DATABASE_URL_UNPOOLED: "dev-direct-url",
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY:
        "provider-credential-secret-at-least-32",
      ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
      CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
    });

    expect(stagingPreview.resolvedTier).toBe("staging");
    expect(stagingPreview.APP_URL).toBe(
      "https://preview-subhub-example.vercel.app",
    );
    expect(stagingPreview.DATABASE_URL).toBe("staging-pooled-url");
    expect(localDevelopment.resolvedTier).toBe("development");
    expect(localDevelopment.DATABASE_URL_UNPOOLED).toBe("dev-direct-url");
  });
});
