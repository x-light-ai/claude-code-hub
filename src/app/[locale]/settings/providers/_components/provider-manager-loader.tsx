"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getProviderStatisticsAsync,
  getProviders,
  getProvidersHealthStatus,
} from "@/actions/providers";
import type { CurrencyCode } from "@/lib/utils/currency";
import type { ProviderDisplay, ProviderStatisticsMap } from "@/types/provider";
import type { User } from "@/types/user";
import { AddProviderDialog } from "./add-provider-dialog";
import { ProviderManager } from "./provider-manager";

type ProviderHealthStatus = Record<
  number,
  {
    circuitState: "closed" | "open" | "half-open";
    failureCount: number;
    lastFailureTime: number | null;
    circuitOpenUntil: number | null;
    recoveryMinutes: number | null;
  }
>;

interface ProviderManagerLoaderProps {
  currentUser?: User;
  enableMultiProviderTypes?: boolean;
  currencyCode?: CurrencyCode;
}

function ProviderManagerLoaderContent({
  currentUser,
  enableMultiProviderTypes = true,
  currencyCode = "USD",
}: ProviderManagerLoaderProps) {
  const [shouldLoadSecondaryData, setShouldLoadSecondaryData] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(() => setShouldLoadSecondaryData(true), {
        timeout: 1000,
      });
      return () => {
        window.cancelIdleCallback(idleCallbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => setShouldLoadSecondaryData(true), 300);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  const {
    data: providers = [],
    isLoading: isProvidersLoading,
    isFetching: isProvidersFetching,
  } = useQuery<ProviderDisplay[]>({
    queryKey: ["providers"],
    queryFn: getProviders,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: healthStatus = {} as ProviderHealthStatus, isFetching: isHealthFetching } =
    useQuery<ProviderHealthStatus>({
      queryKey: ["providers-health"],
      queryFn: getProvidersHealthStatus,
      enabled: shouldLoadSecondaryData,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    });

  const { data: statistics = {} as ProviderStatisticsMap, isLoading: isStatisticsLoading } =
    useQuery<ProviderStatisticsMap>({
      queryKey: ["providers-statistics"],
      queryFn: getProviderStatisticsAsync,
      enabled: shouldLoadSecondaryData,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      refetchInterval: 60_000,
    });

  const loading = isProvidersLoading;
  const refreshing = !loading && (isProvidersFetching || (shouldLoadSecondaryData && isHealthFetching));

  return (
    <ProviderManager
      providers={providers}
      currentUser={currentUser}
      healthStatus={healthStatus}
      statistics={statistics}
      statisticsLoading={isStatisticsLoading}
      currencyCode={currencyCode}
      enableMultiProviderTypes={enableMultiProviderTypes}
      loading={loading}
      refreshing={refreshing}
      addDialogSlot={<AddProviderDialog enableMultiProviderTypes={enableMultiProviderTypes} />}
    />
  );
}

export function ProviderManagerLoader(props: ProviderManagerLoaderProps) {
  return <ProviderManagerLoaderContent {...props} />;
}
