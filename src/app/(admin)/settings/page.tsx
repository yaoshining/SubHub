import { SettingsClient } from "@/app/(admin)/settings/settings-client";
import { getSystemReadiness } from "@/server/services/settings-service";

export default async function SettingsPage() {
  const initialStatus = await getSystemReadiness().catch(() => undefined);

  return <SettingsClient initialStatus={initialStatus} />;
}
