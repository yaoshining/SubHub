export const localTestPostgresBaseline = {
  containerName: "subhub-postgres-test",
  image: "postgres:16-alpine",
  host: "127.0.0.1",
  hostPort: 55432,
  containerPort: 5432,
  databaseName: "subhub_test",
  username: "subhub_test",
  password: "subhub_test_password",
} as const;

export type LocalTestDatabaseUrls = {
  runtimeUrl: string;
  directUrl: string;
};

const encode = (value: string) => encodeURIComponent(value);

export const buildLocalTestDatabaseUrls = (): LocalTestDatabaseUrls => {
  const { host, hostPort, databaseName, username, password } =
    localTestPostgresBaseline;
  const auth = `${encode(username)}:${encode(password)}`;
  const databasePath = encode(databaseName);
  const baseUrl = `postgresql://${auth}@${host}:${hostPort}/${databasePath}`;

  return {
    runtimeUrl: baseUrl,
    directUrl: baseUrl,
  };
};

export const withLocalTestDatabaseEnvDefaults = (
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => {
  const urls = buildLocalTestDatabaseUrls();

  return {
    ...source,
    DATABASE_URL_TEST: source.DATABASE_URL_TEST ?? urls.runtimeUrl,
    DATABASE_URL_TEST_UNPOOLED:
      source.DATABASE_URL_TEST_UNPOOLED ?? urls.directUrl,
  };
};

export const applyLocalTestDatabaseEnvDefaults = (
  target: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv =>
  Object.assign(target, withLocalTestDatabaseEnvDefaults(target));

/**
 * 解析当前生效的测试数据库 URL。
 *
 * 优先使用 env 中已显式配置的 DATABASE_URL_TEST / DATABASE_URL_TEST_UNPOOLED
 * （兼容 CI Postgres service container 与本地自定义配置），
 * 若未配置则回退到本地 Docker Postgres 默认值。
 *
 * 与 buildLocalTestDatabaseUrls() 的区别：
 * - buildLocalTestDatabaseUrls() 始终返回本地 Docker 硬编码 URL（用于单元测试断言）
 * - resolveTestDatabaseUrls() 优先读取 env，适合集成测试与 CI 场景
 */
export const resolveTestDatabaseUrls = (
  env: NodeJS.ProcessEnv = process.env,
): LocalTestDatabaseUrls => {
  const resolved = withLocalTestDatabaseEnvDefaults(env);

  return {
    runtimeUrl: resolved.DATABASE_URL_TEST as string,
    directUrl: resolved.DATABASE_URL_TEST_UNPOOLED as string,
  };
};
