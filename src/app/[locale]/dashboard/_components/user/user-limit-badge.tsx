"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface UserLimitBadgeProps {
  usage: number;
  limit: number | null;
  label: string;
  unit?: string;
}

function formatPercentage(usage: number, limit: number): string {
  const percentage = Math.min(Math.round((usage / limit) * 100), 999);
  return `${percentage}%`;
}

function formatValue(value: number, unit?: string): string {
  if (!Number.isFinite(value)) return String(value);
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");
  return unit ? `${unit}${formatted}` : formatted;
}

function getPercentageColor(usage: number, limit: number): string {
  const percentage = (usage / limit) * 100;
  if (percentage >= 100) return "text-destructive";
  if (percentage >= 80) return "text-orange-600";
  return "";
}

export function UserLimitBadge({ usage, limit, label, unit = "" }: UserLimitBadgeProps) {
  if (limit === null || limit === undefined) {
    return (
      <Badge
        variant="outline"
        className="px-2 py-0.5 tabular-nums text-xs"
        title={`${label}: -`}
        aria-label={`${label}: -`}
      >
        -
      </Badge>
    );
  }

  const percentage = formatPercentage(usage, limit);
  const colorClass = getPercentageColor(usage, limit);
  const statusText = `${formatValue(usage, unit)} / ${formatValue(limit, unit)}`;

  return (
    <Badge
      variant="secondary"
      className={cn("px-2 py-0.5 tabular-nums text-xs", colorClass)}
      title={`${label}: ${statusText}`}
      aria-label={`${label}: ${statusText}`}
    >
      {percentage}
    </Badge>
  );
}
