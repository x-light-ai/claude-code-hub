import dynamic from "next/dynamic";
import { getMyQuota } from "@/actions/my-usage";
import { getServerTimeZone } from "@/actions/system-config";
import { CollapsibleQuotaCard } from "./_components/collapsible-quota-card";
import { ExpirationInfo } from "./_components/expiration-info";
import { MyUsageHeader } from "./_components/my-usage-header";
import { ProviderGroupInfo } from "./_components/provider-group-info";
import { UsageLogsSection } from "./_components/usage-logs-section";

const StatisticsSummaryCard = dynamic(
  () => import("./_components/statistics-summary-card").then((mod) => mod.StatisticsSummaryCard),
  {
    ssr: false,
    loading: () => <div className="min-h-[320px] rounded-lg border bg-card" />,
  }
);

export default async function MyUsagePage() {
  const [quotaResult, timeZoneResult] = await Promise.all([getMyQuota(), getServerTimeZone()]);

  const quota = quotaResult.ok ? quotaResult.data : null;
  const serverTimeZone = timeZoneResult.ok ? timeZoneResult.data.timeZone : undefined;
  const keyExpiresAt = quota?.expiresAt ?? null;
  const userExpiresAt = quota?.userExpiresAt ?? null;

  return (
    <div className="space-y-6">
      <MyUsageHeader keyName={quota?.keyName} userName={quota?.userName} />

      {quota ? (
        <div className="space-y-3">
          <ProviderGroupInfo
            keyProviderGroup={quota.keyProviderGroup}
            userProviderGroup={quota.userProviderGroup}
            userAllowedModels={quota.userAllowedModels}
            userAllowedClients={quota.userAllowedClients}
          />
          <ExpirationInfo
            keyExpiresAt={keyExpiresAt}
            userExpiresAt={userExpiresAt}
            userRpmLimit={quota.userRpmLimit}
            timezone={serverTimeZone}
          />
        </div>
      ) : null}

      <CollapsibleQuotaCard quota={quota} loading={false} />

      <StatisticsSummaryCard serverTimeZone={serverTimeZone} />

      <UsageLogsSection autoRefreshSeconds={30} serverTimeZone={serverTimeZone} />
    </div>
  );
}
