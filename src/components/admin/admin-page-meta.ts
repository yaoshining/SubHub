export type AdminPageMeta = {
  title: string;
  description: string;
};

const knownAdminPageMetas: AdminPageMeta[] = [
  {
    title: "仪表盘",
    description: "查看 SubHub 当前运营状态与下一步配置入口。",
  },
  {
    title: "服务商",
    description: "比较 Provider 状态、创建 OpenSubtitles 实例并检查凭据池。",
  },
  {
    title: "服务商详情",
    description: "调整单个 Provider 的运行策略、凭据池与最近行为。",
  },
  {
    title: "API 密钥",
    description: "管理下游调用方 Key 生命周期与受控明文展示。",
  },
  {
    title: "用户",
    description: "查看后台成员、邀请、暂停恢复与基础会话处置。",
  },
  {
    title: "设置",
    description: "确认系统状态，并跳转到正确治理页完成深配置。",
  },
];

const dashboardMeta = knownAdminPageMetas[0]!;

export function getAdminPageMeta(
  pathname: string | null | undefined,
): AdminPageMeta {
  const path = pathname?.split("?")[0] ?? "/dashboard";

  if (path.startsWith("/providers/")) {
    return knownAdminPageMetas[2]!;
  }
  if (path === "/providers") {
    return knownAdminPageMetas[1]!;
  }
  if (path === "/api-keys") {
    return knownAdminPageMetas[3]!;
  }
  if (path === "/users") {
    return knownAdminPageMetas[4]!;
  }
  if (path === "/settings") {
    return knownAdminPageMetas[5]!;
  }

  return dashboardMeta;
}

export function isKnownAdminPageMeta(meta: AdminPageMeta) {
  return knownAdminPageMetas.some(
    (item) =>
      item.title === meta.title && item.description === meta.description,
  );
}
