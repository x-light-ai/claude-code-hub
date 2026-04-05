"use client";

import { format } from "date-fns";
import { BarChart3, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMyStatsSummary, type MyStatsSummary } from "@/actions/my-usage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenAmount } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { LogsDateRangePicker } from "../../dashboard/logs/_components/logs-date-range-picker";

interface StatisticsSummaryCardProps {
  className?: string;
  autoRefreshSeconds?: number;
  serverTimeZone?: string;
}

export function StatisticsSummaryCard({
  className,
  autoRefreshSeconds = 30,
  serverTimeZone,
}: StatisticsSummaryCardProps) {
  const t = useTranslations("myUsage.stats");
  const [stats, setStats] = useState<MyStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return { startDate: today, endDate: today };
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadStats = useCallback(async () => {
    const result = await getMyStatsSummary({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    if (result.ok) {
      setStats(result.data);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  // Initial load on date range change
  useEffect(() => {
    setLoading(true);
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  // Auto-refresh with visibility change handling
  useEffect(() => {
    const POLL_INTERVAL = autoRefreshSeconds * 1000;

    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        loadStats();
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadStats();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadStats, autoRefreshSeconds]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleDateRangeChange = useCallback((range: { startDate?: string; endDate?: string }) => {
    setDateRange(range);
  }, []);

  const isLoading = loading || refreshing;
  const currencyCode = stats?.currencyCode ?? "USD";

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("autoRefresh", { seconds: autoRefreshSeconds })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <LogsDateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onDateRangeChange={handleDateRangeChange}
            serverTimeZone={serverTimeZone}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border bg-card/50 p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Main metrics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {/* Total Requests */}
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t("totalRequests")}</div>
                <div className="text-2xl font-mono font-semibold">
                  {stats.totalRequests.toLocaleString()}
                </div>
              </div>

              {/* Total Cost */}
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t("totalCost")}</div>
                <div className="text-2xl font-mono font-semibold">
                  {formatCurrency(stats.totalCost, currencyCode)}
                </div>
              </div>

              {/* Total Tokens */}
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t("totalTokens")}</div>
                <div className="text-2xl font-mono font-semibold">
                  {formatTokenAmount(stats.totalTokens)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>{t("input")}:</span>
                    <span className="font-mono">{formatTokenAmount(stats.totalInputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("output")}:</span>
                    <span className="font-mono">{formatTokenAmount(stats.totalOutputTokens)}</span>
                  </div>
                </div>
              </div>

              {/* Cache Tokens */}
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{t("cacheTokens")}</div>
                <div className="text-2xl font-mono font-semibold">
                  {formatTokenAmount(stats.totalCacheCreationTokens + stats.totalCacheReadTokens)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>{t("write")}:</span>
                    <span className="font-mono">
                      {formatTokenAmount(stats.totalCacheCreationTokens)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("read")}:</span>
                    <span className="font-mono">
                      {formatTokenAmount(stats.totalCacheReadTokens)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">{t("noData")}</p>
        )}
      </CardContent>
    </Card>
  );
}
