/**
 * 数据库 URL 解析唯一真源
 *
 * 所有需要数据库连接 URL 的代码（postgres-client.ts、drizzle.config.ts、
 * 数据库脚本等）必须通过本模块获取 URL，禁止各自独立读取环境变量。
 *
 * 规则：
 * - 本地 development（NODE_ENV=development 且无 VERCEL_ENV）：
 *   使用 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED
 * - Vercel development（VERCEL_ENV=development）：
 *   使用 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED
 * - Vercel production / preview（VERCEL_ENV=production|preview）：
 *   使用 DATABASE_URL / DATABASE_URL_UNPOOLED
 * - test（NODE_ENV=test）：
 *   使用 DATABASE_URL / DATABASE_URL_UNPOOLED（可为占位符）
 *
 * 关于"如何判断是否 dev 环境"：
 * 仅靠 NODE_ENV=development 是不够的，因为 `tsx -e` 运行的脚本不会
 * 自动注入 NODE_ENV=development，此时 process.env.NODE_ENV 为 undefined。
 * 因此判断依据是"用户提供的变量类型"：
 *   - 注入了 DATABASE_URL* → 视为 production/preview/test
 *   - 注入了 DEV_DATABASE_URL* → 视为 development
 *   - VERCEL_ENV 显式为 production/preview → 强制 production/preview
 *   - VERCEL_ENV 显式为 development → 强制 development
 *   - 都没注入 → 报错
 */

export type DbUrlPair = {
  pooledUrl: string;
  directUrl: string;
};

export type DbUrlEnvSource = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "VERCEL_ENV"
    | "DATABASE_URL"
    | "DATABASE_URL_UNPOOLED"
    | "DEV_DATABASE_URL"
    | "DEV_DATABASE_URL_UNPOOLED"
  >
>;

const normalizeDatabaseUrl = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

/**
 * 判断当前是否属于 development 环境（本地 dev 或 Vercel dev）。
 * 此时应使用 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED 而非 DATABASE_URL*。
 *
 * 优先级（从高到低）：
 * 1. VERCEL_ENV=development → 强制 dev
 * 2. VERCEL_ENV=production|preview → 强制 production/preview
 * 3. NODE_ENV=test → 强制 test（视为 production/preview 分支，使用 DATABASE_URL*）
 * 4. 显式 NODE_ENV=development 且无 VERCEL_ENV → 强制 local development
 * 5. 用户注入了 DEV_DATABASE_URL*（且未注入 DATABASE_URL*）→ dev
 * 6. 用户注入了 DATABASE_URL*（且未注入 DEV_DATABASE_URL*）→ production/preview
 * 7. 两者都注入：dev 优先（用户本地跑脚本时即使 .env.production.local
 *    漏出 DATABASE_URL，DEV_* 注入也代表用户明确要 dev 行为）
 * 8. 两者都未注入：回退到 NODE_ENV 判断
 */
export function isDevEnvironment(env: DbUrlEnvSource = process.env): boolean {
  const devDatabaseUrl = normalizeDatabaseUrl(env.DEV_DATABASE_URL);
  const devDatabaseUrlUnpooled = normalizeDatabaseUrl(
    env.DEV_DATABASE_URL_UNPOOLED,
  );
  const databaseUrl = normalizeDatabaseUrl(env.DATABASE_URL);
  const databaseUrlUnpooled = normalizeDatabaseUrl(env.DATABASE_URL_UNPOOLED);

  if (env.VERCEL_ENV === "development") return true;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    return false;
  }
  if (env.NODE_ENV === "test") return false;
  if (env.NODE_ENV === "development") return true;

  const hasDev = Boolean(devDatabaseUrl || devDatabaseUrlUnpooled);
  const hasProd = Boolean(databaseUrl || databaseUrlUnpooled);

  if (hasDev && !hasProd) return true;
  if (hasProd && !hasDev) return false;
  if (hasDev && hasProd) return true; // dev 优先：本地脚本场景

  return false;
}

/**
 * 解析数据库 URL 对（pooled + direct）。
 *
 * 这是仓库中数据库 URL 选择规则的唯一正式真源。
 * 所有数据库接入点必须调用本函数，禁止各自手写 fallback 逻辑。
 *
 * @param env - 环境变量来源，默认为 process.env
 * @throws 当所需变量缺失或不合法时抛出明确错误
 */
export function resolveDbUrls(env: DbUrlEnvSource = process.env): DbUrlPair {
  if (isDevEnvironment(env)) {
    const pooledUrl = normalizeDatabaseUrl(env.DEV_DATABASE_URL);
    const directUrl = normalizeDatabaseUrl(env.DEV_DATABASE_URL_UNPOOLED);

    if (!pooledUrl) {
      throw new Error(
        "DEV_DATABASE_URL 未配置。本地 development 环境必须通过 DEV_DATABASE_URL 提供数据库连接，" +
          "禁止使用 DATABASE_URL（避免误连正式数据库）。",
      );
    }

    if (!directUrl) {
      throw new Error(
        "DEV_DATABASE_URL_UNPOOLED 未配置。本地 development 环境必须通过 DEV_DATABASE_URL_UNPOOLED 提供 direct 数据库连接，" +
          "禁止使用 DATABASE_URL_UNPOOLED（避免误连正式数据库）。",
      );
    }

    return { pooledUrl, directUrl };
  }

  // Vercel production / preview、test、及其他非 dev 环境：使用 DATABASE_URL*
  const pooledUrl = normalizeDatabaseUrl(env.DATABASE_URL);
  const directUrl = normalizeDatabaseUrl(env.DATABASE_URL_UNPOOLED);

  if (!pooledUrl) {
    throw new Error(
      "DATABASE_URL 未配置。Vercel production / preview 环境必须注入 DATABASE_URL。",
    );
  }

  if (!directUrl) {
    throw new Error(
      "DATABASE_URL_UNPOOLED 未配置。Vercel production / preview 环境必须注入 DATABASE_URL_UNPOOLED。",
    );
  }

  return { pooledUrl, directUrl };
}

/**
 * 解析 pooled（运行时）数据库 URL。
 * 对于需要单独获取 pooled URL 的场景使用此函数。
 */
export function resolvePooledDbUrl(env: DbUrlEnvSource = process.env): string {
  return resolveDbUrls(env).pooledUrl;
}

/**
 * 解析 direct（unpooled）数据库 URL。
 * 主要用于 migration、schema 检查等需要直连的场景。
 */
export function resolveDirectDbUrl(env: DbUrlEnvSource = process.env): string {
  return resolveDbUrls(env).directUrl;
}
