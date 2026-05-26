import path from "node:path";
import { AppError } from "@/lib/errors";

export type ServerEnv = {
  nodeEnv: "development" | "production" | "test";
  sqlitePath: string;
  providerCredentialsEncryptionKey: string | null;
};

type EnvSource = NodeJS.ProcessEnv;

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), ".data", "subhub.sqlite");
const TEST_SQLITE_PATH = path.join(
  process.cwd(),
  ".data",
  "subhub.test.sqlite"
);

function readNodeEnv(value: string | undefined): ServerEnv["nodeEnv"] {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

export function getServerEnv(source: EnvSource = process.env): ServerEnv {
  const nodeEnv = readNodeEnv(source.NODE_ENV);
  const sqlitePath =
    source.SUBHUB_SQLITE_PATH ||
    (nodeEnv === "test" ? TEST_SQLITE_PATH : DEFAULT_SQLITE_PATH);
  const providerCredentialsEncryptionKey =
    source.PROVIDER_CREDENTIALS_ENCRYPTION_KEY ?? null;

  if (nodeEnv === "production" && !providerCredentialsEncryptionKey) {
    throw new AppError(
      "INTERNAL_ERROR",
      "生产环境必须配置 PROVIDER_CREDENTIALS_ENCRYPTION_KEY。",
      500
    );
  }

  return {
    nodeEnv,
    sqlitePath,
    providerCredentialsEncryptionKey
  };
}
