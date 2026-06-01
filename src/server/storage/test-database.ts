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
