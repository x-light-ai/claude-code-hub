"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { parseDateInputAsTimezone } from "@/lib/utils/date-input";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { formatZodError } from "@/lib/utils/zod-i18n";
import { createKey, deleteKey, findKeyList } from "@/repository/key";
import { createUser, findUserByName, updateUser } from "@/repository/user";
import type { ActionResult } from "./types";

// CUSTOM: 发货系统专用接口

const ProvisionSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  expiresAt: z.string().min(1, "过期时间不能为空"),
  dailyLimitUsd: z.number().optional(),
  limitConcurrentSessions: z.number().optional(),
  dailyResetMode: z.enum(["fixed", "rolling"]).optional(),
  dailyResetTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "重置时间格式必须为 HH:mm")
    .optional(),
  regenerateKey: z.boolean().optional().default(false),
});

type ProvisionData = z.infer<typeof ProvisionSchema>;

interface ProvisionResult {
  apiKey: string;
  userId: number;
  username: string;
  expiresAt: string;
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
      expiresAt,
      dailyLimitUsd,
      limitConcurrentSessions,
      dailyResetMode,
      dailyResetTime,
      regenerateKey,
    } = validated.data;
    const effectiveDailyResetMode = dailyResetMode ?? "rolling";

    const timezone = await resolveSystemTimezone();
    const expiresAtDate = parseDateInputAsTimezone(expiresAt, timezone);

    let user = await findUserByName(username);
    let isNewUser = false;

    if (!user) {
      user = await createUser({
        name: username,
        description: "发货系统自动创建",
        dailyQuota: dailyLimitUsd,
        limitConcurrentSessions,
        dailyResetMode: effectiveDailyResetMode,
        dailyResetTime,
        expiresAt: expiresAtDate,
      });
      isNewUser = true;
    } else {
      await updateUser(user.id, {
        dailyQuota: dailyLimitUsd,
        limitConcurrentSessions,
        dailyResetMode: effectiveDailyResetMode,
        dailyResetTime,
        expiresAt: expiresAtDate,
      });
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
        name: "发货系统生成",
        is_enabled: true,
        expires_at: expiresAtDate,
      });
      isNewKey = true;
    } else {
      const existingKeys = await findKeyList(user.id);
      if (existingKeys.length > 0) {
        apiKey = existingKeys[0].key;
      } else {
        apiKey = `sk-${randomBytes(16).toString("hex")}`;
        await createKey({
          user_id: user.id,
          key: apiKey,
          name: "发货系统生成",
          is_enabled: true,
          expires_at: expiresAtDate,
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
        expiresAt: expiresAtDate.toISOString(),
        isNewUser,
        isNewKey,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "发货失败";
    return { ok: false, error: message };
  }
}


