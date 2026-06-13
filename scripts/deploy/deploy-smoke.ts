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

type SmokeCheck = {
  path: string;
  label: string;
  validate: (response: Response, bodyText: string) => Promise<void> | void;
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
    validate: async (response, bodyText) => {
      await requireOk(response, bodyText, "bootstrap 状态入口");

      const payload = JSON.parse(bodyText) as {
        data?: { initialized?: boolean };
      };

      if (typeof payload.data?.initialized !== "boolean") {
        throw new Error(
          "bootstrap 状态入口 smoke 失败：响应未返回 data.initialized 布尔值。",
        );
      }
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

    await check.validate(response, bodyText);
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
