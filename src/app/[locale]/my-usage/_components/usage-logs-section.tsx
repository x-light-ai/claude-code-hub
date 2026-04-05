"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyAvailableModels, getMyUsageLogsBatch } from "@/actions/my-usage";
import { LogsDateRangePicker } from "@/app/[locale]/dashboard/logs/_components/logs-date-range-picker";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UsageLogsTable } from "./usage-logs-table";

const BATCH_SIZE = 20;

interface UsageLogsSectionProps {
  autoRefreshSeconds?: number;
  defaultOpen?: boolean;
  serverTimeZone?: string;
}

interface Filters {
  startDate?: string;
  endDate?: string;
  model?: string;
}

export function UsageLogsSection({
  autoRefreshSeconds,
  defaultOpen = false,
  serverTimeZone,
}: UsageLogsSectionProps) {
  const t = useTranslations("myUsage.logs");
  const tCollapsible = useTranslations("myUsage.logsCollapsible");
  const tCommon = useTranslations("common");
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [models, setModels] = useState<string[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsModelsLoading(true);

    void getMyAvailableModels()
      .then((modelsResult) => {
        if (modelsResult.ok && modelsResult.data) {
          setModels(modelsResult.data);
        }
      })
      .finally(() => setIsModelsLoading(false));
  }, [isOpen]);

  const query = useInfiniteQuery({
    queryKey: ["my-usage-logs-batch", appliedFilters],
    enabled: isOpen,
    queryFn: async ({ pageParam }) => {
      const result = await getMyUsageLogsBatch({
        ...appliedFilters,
        cursor: pageParam,
        limit: BATCH_SIZE,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    initialPageParam: undefined as { createdAt: string; id: number } | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const {
    data,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = query;

  const logs = useMemo(() => data?.pages.flatMap((page) => page.logs) ?? [], [data]);
  const latestPage = data?.pages[0];

  const handleFilterChange = (changes: Partial<Filters>) => {
    setDraftFilters((prev) => ({ ...prev, ...changes }));
  };

  const handleApply = () => {
    const nextFilters = { ...draftFilters };
    if (JSON.stringify(nextFilters) === JSON.stringify(appliedFilters)) {
      return;
    }
    setAppliedFilters(nextFilters);
  };

  const handleReset = () => {
    setDraftFilters({});
    if (Object.keys(appliedFilters).length === 0) {
      return;
    }
    setAppliedFilters({});
  };

  const handleDateRangeChange = (range: { startDate?: string; endDate?: string }) => {
    handleFilterChange(range);
  };

  const handleLoadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const errorMessage = isError ? (error instanceof Error ? error.message : t("loadFailed")) : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between gap-4 p-4",
              "hover:bg-muted/50 transition-colors",
              isOpen && "border-b"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <ScrollText className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">{tCollapsible("title")}</span>
            </div>

            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    {t("filters.startDate")} / {t("filters.endDate")}
                  </Label>
                  <LogsDateRangePicker
                    startDate={draftFilters.startDate}
                    endDate={draftFilters.endDate}
                    onDateRangeChange={handleDateRangeChange}
                    serverTimeZone={serverTimeZone}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("filters.model")}</Label>
                  <Select
                    value={draftFilters.model ?? "__all__"}
                    onValueChange={(value) =>
                      handleFilterChange({ model: value === "__all__" ? undefined : value })
                    }
                    disabled={isModelsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={isModelsLoading ? tCommon("loading") : t("filters.allModels")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("filters.allModels")}</SelectItem>
                      {models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-end gap-2 lg:shrink-0">
                <Button size="sm" onClick={handleApply} disabled={isLoading} className="min-w-20">
                  查询
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="min-w-20"
                >
                  {t("filters.reset")}
                </Button>
              </div>
            </div>

            <UsageLogsTable
              logs={logs}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              currencyCode={latestPage?.currencyCode}
              loading={isLoading}
              loadingLabel={tCommon("loading")}
              errorMessage={errorMessage}
              onLoadMore={handleLoadMore}
              resetScrollKey={appliedFilters}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
