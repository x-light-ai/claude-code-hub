import { getMyQuota } from "@/actions/my-usage";
import { getServerTimeZone } from "@/actions/system-config";
import { StatisticsSummaryCard } from "./_components/statistics-summary-card";
import { CollapsibleQuotaCard } from "./_components/collapsible-quota-card";
import { ExpirationInfo } from "./_components/expiration-info";
import { MyUsageHeader } from "./_components/my-usage-header";
import { UsageLogsSection } from "./_components/usage-logs-section";

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
        <ExpirationInfo
          keyExpiresAt={keyExpiresAt}
          userRpmLimit={quota.userRpmLimit}
          timezone={serverTimeZone}
        />
      ) : null}

      <CollapsibleQuotaCard quota={quota} loading={false} />

      <StatisticsSummaryCard serverTimeZone={serverTimeZone} />

      <UsageLogsSection autoRefreshSeconds={30} serverTimeZone={serverTimeZone} />
    </div>
  );
}
