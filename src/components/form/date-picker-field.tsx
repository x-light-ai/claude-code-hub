"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * DatePickerField component props
 */
export interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearLabel?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  description?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatDateTime(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Parse YYYY-MM-DD or YYYY-MM-DDTHH:mm[:ss] string to Date object
 * Uses local timezone to avoid off-by-one errors
 */
function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return undefined;
    return new Date(year, month - 1, day);
  }

  const matched = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!matched) return undefined;

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = matched;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = secondStr ? Number(secondStr) : 0;

  if (
    [year, month, day, hour, minute, second].some((part) => Number.isNaN(part)) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function extractTimeValue(value: string): string {
  const matched = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})(?::\d{2})?$/);
  return matched?.[1] ?? "23:59";
}

/**
 * DatePickerField - A form-integrated date picker using shadcn/ui Calendar
 * Replaces native HTML date input with a consistent, styled date picker
 */
export function DatePickerField({
  label,
  value,
  onChange,
  clearLabel,
  error,
  touched,
  required,
  description,
  placeholder,
  minDate,
  maxDate,
  disabled,
  className,
  id,
}: DatePickerFieldProps) {
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const hasError = Boolean(touched && error);
  const autoId = useId();
  const fieldId = id || `datepicker-${autoId}`;

  const selectedDate = useMemo(() => parseDate(value), [value]);
  const timeValue = useMemo(() => extractTimeValue(value), [value]);

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      date.setHours(hours ?? 23, minutes ?? 59, 59, 0);
      onChange(formatDateTime(date));
      return;
    }
    onChange("");
  };

  const handleTimeChange = useCallback(
    (nextTime: string) => {
      if (!selectedDate) return;
      const [hours, minutes] = nextTime.split(":").map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
      const nextDate = new Date(selectedDate);
      nextDate.setHours(hours, minutes, 59, 0);
      onChange(formatDateTime(nextDate));
    },
    [onChange, selectedDate]
  );

  const displayValue = useMemo(() => {
    if (!value) return placeholder || "";
    return value.replace("T", " ");
  }, [value, placeholder]);

  const disabledMatcher = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={fieldId}
        className={cn(required && "after:content-['*'] after:ml-0.5 after:text-destructive")}
      >
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal h-9",
              !value && "text-muted-foreground",
              hasError && "border-destructive focus-visible:ring-destructive"
            )}
            aria-invalid={hasError}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-describedby={
              hasError ? `${fieldId}-error` : description ? `${fieldId}-description` : undefined
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate || new Date()}
            disabled={disabledMatcher}
          />
          <div className="border-t p-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-time`} className="text-xs text-muted-foreground">
                {tCommon("time")}
              </Label>
              <Input
                id={`${fieldId}-time`}
                type="time"
                step={60}
                value={timeValue}
                disabled={disabled || !selectedDate}
                onChange={(event) => handleTimeChange(event.target.value)}
              />
            </div>
            {value && (
              <Button variant="ghost" size="sm" className="w-full" onClick={handleClear}>
                {clearLabel || tCommon("clearDate")}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {description && !hasError && (
        <div id={`${fieldId}-description`} className="text-xs text-muted-foreground">
          {description}
        </div>
      )}
      {hasError && (
        <div id={`${fieldId}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
