"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { parseDateInputAsTimezone } from "@/lib/utils/date-input";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { formatZodError } from "@/lib/utils/zod-i18n";
import { createKey, deleteKey, findKeyList, updateKey } from "@/repository/key";
import { createUser, findUserByName } from "@/repository/user";
import type { ActionResult } from "./types";

// CUSTOM: 发货系统专用接口

const ProvisionSchema = z
  .object({
    username: z.string().min(1, "用户名不能为空"),
    keyName: z.string().optional(),
    expiresAt: z.string().min(1, "过期时间不能为空").optional(),
    durationDays: z.coerce
      .number()
      .int("相对有效期必须是整数天")
      .min(1, "相对有效期至少为1天")
      .max(3650, "相对有效期不能超过3650天")
      .optional(),
    dailyLimitUsd: z.number().optional(),
    limitTotalUsd: z.number().min(0, "总消费上限不能为负数").max(10000000, "总消费上限不能超过10000000美元").nullable().optional(),
    limitConcurrentSessions: z.number().optional(),
    dailyResetMode: z.enum(["fixed", "rolling"]).optional(),
    dailyResetTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "重置时间格式必须为 HH:mm")
      .optional(),
    regenerateKey: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.expiresAt && data.durationDays == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "必须提供 expiresAt 或 durationDays",
        path: ["expiresAt"],
      });
    }

    if (data.expiresAt && data.durationDays != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAt 与 durationDays 不能同时传入",
        path: ["durationDays"],
      });
    }
  });

type ProvisionData = z.infer<typeof ProvisionSchema>;

interface ProvisionResult {
  apiKey: string;
  userId: number;
  username: string;
  expiresAt: string | null;
  durationDays: number | null;
  isNewUser: boolean;
  isNewKey: boolean;
}

export async function provision(data: ProvisionData): Promise<ActionResult<ProvisionResult>> {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return { ok: false, error: "需要管理员权限" };
    }

    const validated = ProvisionSchema.safeParse(data);
    if (!validated.success) {
      return { ok: false, error: formatZodError(validated.error) };
    }

    const {
      username,
      keyName,
      expiresAt,
      durationDays,
      dailyLimitUsd,
      limitTotalUsd,
      limitConcurrentSessions,
      dailyResetMode,
      dailyResetTime,
      regenerateKey,
    } = validated.data;
    const effectiveDailyResetMode = dailyResetMode ?? "rolling";
    const effectiveKeyName = keyName?.trim() || "api";

    const timezone = await resolveSystemTimezone();
    const expiresAtDate =
      expiresAt !== undefined ? parseDateInputAsTimezone(expiresAt, timezone) : undefined;

    let user = await findUserByName(username);
    let isNewUser = false;

    if (!user) {
      user = await createUser({
        name: username,
        description: "",
      });
      isNewUser = true;
    }

    let apiKey: string;
    let isNewKey = false;

    if (regenerateKey) {
      const existingKeys = await findKeyList(user.id);
      for (const key of existingKeys) {
        await deleteKey(key.id);
      }
      apiKey = `sk-${randomBytes(16).toString("hex")}`;
      await createKey({
        user_id: user.id,
        key: apiKey,
        name: effectiveKeyName,
        is_enabled: true,
        expires_at: expiresAtDate ?? null,
        duration_days: durationDays ?? null,
        limit_daily_usd: dailyLimitUsd ?? null,
        limit_total_usd: limitTotalUsd ?? null,
        daily_reset_mode: effectiveDailyResetMode,
        daily_reset_time: effectiveDailyResetMode === "fixed" ? dailyResetTime : undefined,
        limit_concurrent_sessions: limitConcurrentSessions,
      });
      isNewKey = true;
    } else {
      const existingKeys = await findKeyList(user.id);
      if (existingKeys.length > 0) {
        const existingKey = existingKeys[0];
        apiKey = existingKey.key;
        await updateKey(existingKey.id, {
          expires_at: expiresAtDate ?? null,
          duration_days: durationDays ?? null,
          limit_daily_usd: dailyLimitUsd ?? null,
          limit_total_usd: limitTotalUsd ?? null,
          daily_reset_mode: effectiveDailyResetMode,
          daily_reset_time: effectiveDailyResetMode === "fixed" ? dailyResetTime : undefined,
          limit_concurrent_sessions: limitConcurrentSessions,
        });
      } else {
        apiKey = `sk-${randomBytes(16).toString("hex")}`;
        await createKey({
          user_id: user.id,
          key: apiKey,
          name: effectiveKeyName,
          is_enabled: true,
          expires_at: expiresAtDate ?? null,
          duration_days: durationDays ?? null,
          limit_daily_usd: dailyLimitUsd ?? null,
          limit_total_usd: limitTotalUsd ?? null,
          daily_reset_mode: effectiveDailyResetMode,
          daily_reset_time: effectiveDailyResetMode === "fixed" ? dailyResetTime : undefined,
          limit_concurrent_sessions: limitConcurrentSessions,
        });
        isNewKey = true;
      }
    }

    return {
      ok: true,
      data: {
        apiKey,
        userId: user.id,
        username: user.name,
        expiresAt: expiresAtDate?.toISOString() ?? null,
        durationDays: durationDays ?? null,
        isNewUser,
        isNewKey,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "发货失败";
    return { ok: false, error: message };
  }
}


