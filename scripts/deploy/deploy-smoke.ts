type DeployTier = "development" | "staging" | "production";

type SmokeOptions = {
  baseUrl: string;
  tier: DeployTier;
  fetchImpl?: typeof fetch;
};

const allowedTiers = new Set<DeployTier>([
  "development",
  "staging",
  "production",
]);

type BootstrapStatusPayload = {
  data?: {
    initialized?: boolean;
    runtimeReady?: boolean;
    runtimeGateRequired?: boolean;
    schemaReady?: boolean;
    bootstrapReady?: boolean;
    adminInitializationState?: "required" | "completed" | "migrated";
    directUrlReady?: boolean;
    blockingReasons?: string[];
  };
};

/**
 * #70 接入点：production tier 必须消费 #64 已落地的 readiness 信号。
 * 不重新定义 readiness 判定，只消费 `runtimeReady` / `blockingReasons` /
 * `schemaReady` / `bootstrapReady` / `adminInitializationState` 字段；
 * 非 production tier 保留对 `data.initialized` 的最小检查。
 */
const requireProductionRuntimeReadiness = (
  payload: BootstrapStatusPayload,
  tier: DeployTier,
) => {
  if (tier !== "production") {
    if (typeof payload.data?.initialized !== "boolean") {
      throw new Error(
        "bootstrap 状态入口 smoke 失败：响应未返回 data.initialized 布尔值。",
      );
    }
    return;
  }

  const data = payload.data;
  if (!data) {
    throw new Error(
      "production bootstrap 状态入口 smoke 失败：响应缺少 data 字段。",
    );
  }

  const requiredBooleanFields = [
    "initialized",
    "runtimeReady",
    "runtimeGateRequired",
    "schemaReady",
    "bootstrapReady",
    "directUrlReady",
  ] as const;

  for (const field of requiredBooleanFields) {
    if (typeof data[field] !== "boolean") {
      throw new Error(
        `production bootstrap 状态入口 smoke 失败：响应缺少 data.${field} 布尔值。`,
      );
    }
  }

  if (
    data.adminInitializationState !== "required" &&
    data.adminInitializationState !== "completed" &&
    data.adminInitializationState !== "migrated"
  ) {
    throw new Error(
      "production bootstrap 状态入口 smoke 失败：响应未返回 data.adminInitializationState 合法值。",
    );
  }

  if (data.runtimeGateRequired !== true) {
    throw new Error(
      "production bootstrap 状态入口 smoke 失败：production tier 必须 runtimeGateRequired=true。",
    );
  }

  if (!data.runtimeReady) {
    const reasons = (data.blockingReasons ?? []).join(", ") || "(无)";
    throw new Error(
      `production runtime readiness 未通过，deploy gate 阻断：${reasons}。`,
    );
  }
};

type SmokeCheck = {
  path: string;
  label: string;
  validate: (
    response: Response,
    bodyText: string,
    tier: DeployTier,
  ) => Promise<void> | void;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const parseArgs = (argv: string[]) => {
  const options = new Map<string, string>();

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, ...rest] = arg.slice(2).split("=");
    options.set(key, rest.join("="));
  }

  const baseUrl = options.get("base-url") ?? process.env.APP_URL;
  const tier = (options.get("tier") ?? process.env.DEPLOYMENT_TIER) as
    | DeployTier
    | undefined;

  if (!baseUrl) {
    throw new Error("deploy smoke 必须提供 --base-url 或 APP_URL。");
  }

  if (!tier || !allowedTiers.has(tier)) {
    throw new Error(
      "deploy smoke 必须提供 --tier 或 DEPLOYMENT_TIER，且值只能是 development、staging、production。",
    );
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    tier,
  };
};

const requireOk = async (
  response: Response,
  bodyText: string,
  label: string,
) => {
  if (response.ok) {
    return;
  }

  throw new Error(
    `${label} smoke 失败：HTTP ${response.status}。` +
      (bodyText ? ` 响应片段：${bodyText.slice(0, 200)}` : ""),
  );
};

const smokeChecks: SmokeCheck[] = [
  {
    path: "/login",
    label: "登录页可达性",
    validate: async (response, bodyText) => {
      await requireOk(response, bodyText, "登录页可达性");

      if (!bodyText.toLowerCase().includes("<!doctype html")) {
        throw new Error("登录页可达性 smoke 失败：响应不是预期的 HTML 文档。");
      }
    },
  },
  {
    path: "/api/openapi.yaml",
    label: "OpenAPI 文档入口",
    validate: async (response, bodyText) => {
      await requireOk(response, bodyText, "OpenAPI 文档入口");

      if (!bodyText.includes("openapi:")) {
        throw new Error(
          "OpenAPI 文档入口 smoke 失败：响应中缺少 openapi 文档头。",
        );
      }
    },
  },
  {
    path: "/api/admin/bootstrap/status",
    label: "bootstrap 状态入口",
    validate: async (response, bodyText, tier) => {
      await requireOk(response, bodyText, "bootstrap 状态入口");

      const payload = JSON.parse(bodyText) as BootstrapStatusPayload;
      requireProductionRuntimeReadiness(payload, tier);
    },
  },
];

export const runDeploySmoke = async ({
  baseUrl,
  tier,
  fetchImpl = fetch,
}: SmokeOptions) => {
  const targetBaseUrl = normalizeBaseUrl(baseUrl);

  for (const check of smokeChecks) {
    const targetUrl = new URL(check.path, `${targetBaseUrl}/`).toString();
    const response = await fetchImpl(targetUrl, {
      headers: {
        "x-subhub-deploy-smoke-tier": tier,
      },
    });
    const bodyText = await response.text();

    await check.validate(response, bodyText, tier);
    console.log(`✓ ${tier} deploy smoke: ${check.label}`);
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  await runDeploySmoke(options);
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("deploy smoke 失败：", message);
    process.exit(1);
  });
}
