import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { createStorageClient } from "../../src/server/storage/client";
import { createDirectPostgresClient } from "../../src/server/storage/postgres-client";
import {
  applyLocalTestDatabaseEnvDefaults,
  buildLocalTestDatabaseUrls,
  localTestPostgresBaseline,
} from "../../src/server/storage/test-database";
import { localRealPostgresTestFiles } from "../../src/server/storage/local-test-postgres-suite";

type CommandName =
  | "start"
  | "stop"
  | "reset"
  | "migrate"
  | "seed"
  | "prepare"
  | "test";

const [command] = process.argv.slice(2) as [CommandName | undefined];

applyLocalTestDatabaseEnvDefaults(process.env);

const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();

const run = (bin: string, args: string[], capture = false) => {
  const result = spawnSync(bin, args, {
    env: process.env,
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
};

const requireSuccess = (bin: string, args: string[]) => {
  const result = run(bin, args);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const ensureDockerAvailable = () => {
  const result = run("docker", ["--version"], true);

  if (result.status !== 0) {
    throw new Error(
      "未检测到可用的 docker 命令，无法启动本地 test Postgres 容器。",
    );
  }
};

const containerExists = () =>
  run(
    "docker",
    ["container", "inspect", localTestPostgresBaseline.containerName],
    true,
  ).status === 0;

const containerRunning = () => {
  if (!containerExists()) {
    return false;
  }

  const result = run(
    "docker",
    [
      "container",
      "inspect",
      "-f",
      "{{.State.Running}}",
      localTestPostgresBaseline.containerName,
    ],
    true,
  );

  return result.status === 0 && String(result.stdout ?? "").trim() === "true";
};

const waitForContainerReady = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = run(
      "docker",
      [
        "exec",
        localTestPostgresBaseline.containerName,
        "pg_isready",
        "-U",
        localTestPostgresBaseline.username,
        "-d",
        localTestPostgresBaseline.databaseName,
      ],
      true,
    );

    if (result.status === 0) {
      return;
    }

    await delay(1000);
  }

  throw new Error(
    "本地 test Postgres 容器已启动，但数据库未在预期时间内就绪。",
  );
};

const ensureContainerRunning = async () => {
  if (!containerRunning()) {
    throw new Error(
      "本地 test Postgres 容器未运行，请先执行 pnpm db:start:test。",
    );
  }

  await waitForContainerReady();
};

const start = async () => {
  ensureDockerAvailable();

  if (!containerExists()) {
    requireSuccess("docker", [
      "run",
      "--name",
      localTestPostgresBaseline.containerName,
      "-e",
      `POSTGRES_DB=${localTestPostgresBaseline.databaseName}`,
      "-e",
      `POSTGRES_USER=${localTestPostgresBaseline.username}`,
      "-e",
      `POSTGRES_PASSWORD=${localTestPostgresBaseline.password}`,
      "-p",
      `${localTestPostgresBaseline.host}:${localTestPostgresBaseline.hostPort}:${localTestPostgresBaseline.containerPort}`,
      "-d",
      localTestPostgresBaseline.image,
    ]);
  } else if (!containerRunning()) {
    requireSuccess("docker", [
      "start",
      localTestPostgresBaseline.containerName,
    ]);
  }

  await waitForContainerReady();

  console.log(
    `本地 test Postgres 已就绪: ${localTestPostgresBaseline.containerName}`,
  );
  console.log(`DATABASE_URL_TEST=${runtimeUrl}`);
  console.log(`DATABASE_URL_TEST_UNPOOLED=${directUrl}`);
};

const stop = async () => {
  ensureDockerAvailable();

  if (!containerExists()) {
    console.log("本地 test Postgres 容器不存在，无需停止。");
    return;
  }

  if (!containerRunning()) {
    console.log("本地 test Postgres 容器已停止，无需重复执行。");
    return;
  }

  requireSuccess("docker", ["stop", localTestPostgresBaseline.containerName]);
};

const remove = async () => {
  ensureDockerAvailable();

  if (!containerExists()) {
    console.log("本地 test Postgres 容器不存在，无需清理。");
    return;
  }

  requireSuccess("docker", [
    "rm",
    "-f",
    localTestPostgresBaseline.containerName,
  ]);
};

const reset = async () => {
  await ensureContainerRunning();

  const client = createDirectPostgresClient({
    directDatabaseUrl: directUrl,
  });

  try {
    await client.sql.unsafe(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT ALL ON SCHEMA public TO public;",
    );
  } finally {
    await client.close();
  }
};

const migrate = async () => {
  await ensureContainerRunning();

  const client = createStorageClient({
    runtimeDatabaseUrl: runtimeUrl,
    directDatabaseUrl: directUrl,
  });

  try {
    await client.migrate();
  } finally {
    await client.close();
  }
};

const seed = async () => {
  await ensureContainerRunning();
  console.log(
    "当前本地 test database 未定义额外 seed，跳过。若后续需要 fixture，请在 db:seed:test 中增量补充。",
  );
};

const prepare = async () => {
  await start();
  await reset();
  await migrate();
  await seed();
};

const runDatabaseTests = async () => {
  let exitCode = 0;

  try {
    await prepare();

    const result = spawnSync(
      "pnpm",
      ["test", "--no-file-parallelism", ...localRealPostgresTestFiles],
      {
        env: {
          ...process.env,
          RUN_POSTGRES_TESTS: "true",
        },
        stdio: "inherit",
      },
    );

    if (result.error) {
      throw result.error;
    }

    exitCode = result.status ?? 1;
  } finally {
    await remove();
  }

  process.exit(exitCode);
};

const commands: Record<CommandName, () => Promise<void>> = {
  start,
  stop,
  reset,
  migrate,
  seed,
  prepare,
  test: runDatabaseTests,
};

if (!command || !(command in commands)) {
  console.error(
    "用法: pnpm tsx scripts/db/local-test-postgres.ts <start|stop|reset|migrate|seed|prepare|test>",
  );
  process.exit(1);
}

const main = async () => {
  await commands[command]();
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
