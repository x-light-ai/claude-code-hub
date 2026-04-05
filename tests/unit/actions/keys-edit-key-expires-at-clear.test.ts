import { beforeEach, describe, expect, test, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const getTranslationsMock = vi.hoisted(() => vi.fn(async () => (key: string) => key));
vi.mock("next-intl/server", () => ({
  getTranslations: getTranslationsMock,
}));

const findKeyByIdMock = vi.fn();
const updateKeyMock = vi.fn();

vi.mock("@/repository/key", () => ({
  countActiveKeysByUser: vi.fn(async () => 1),
  createKey: vi.fn(async () => ({})),
  deleteKey: vi.fn(async () => true),
  findActiveKeyByUserIdAndName: vi.fn(async () => null),
  findKeyById: findKeyByIdMock,
  findKeyList: vi.fn(async () => []),
  findKeysWithStatistics: vi.fn(async () => []),
  updateKey: updateKeyMock,
}));

const findUserByIdMock = vi.fn();
vi.mock("@/repository/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/repository/user")>();
  return {
    ...actual,
    findUserById: findUserByIdMock,
  };
});

describe("editKey: expiresAt 清除/不更新语义", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });

    findKeyByIdMock.mockResolvedValue({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: new Date("2026-01-04T23:59:59.999Z"),
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    findUserByIdMock.mockResolvedValue({
      id: 10,
      name: "u",
      description: "",
      role: "user",
      rpm: null,
      dailyQuota: null,
      providerGroup: "default",
      tags: [],
      limit5hUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: null,
      isEnabled: true,
      expiresAt: null,
      allowedClients: [],
      allowedModels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    updateKeyMock.mockResolvedValue({ id: 1 });
  });

  test("不携带 expiresAt 字段时不应更新 expires_at", async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2" });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledTimes(1);

    const updatePayload = updateKeyMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.hasOwn(updatePayload, "expires_at")).toBe(false);
  });

  test("携带 expiresAt=undefined 时应清除 expires_at（写入 null）", async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", expiresAt: undefined });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledTimes(1);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expires_at: null,
      })
    );
  });

  test('携带 expiresAt="" 时应清除 expires_at（写入 null）', async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", expiresAt: "" });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledTimes(1);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expires_at: null,
      })
    );
  });

  test("携带 expiresAt=YYYY-MM-DD 时应写入对应 Date", async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", expiresAt: "2026-01-04" });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledTimes(1);

    const updatePayload = updateKeyMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload.expires_at).toBeInstanceOf(Date);
    expect(Number.isNaN((updatePayload.expires_at as Date).getTime())).toBe(false);
  });

  test("携带 durationDays 且当前未过期时，应在原 expiresAt 基础上顺延", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", durationDays: 7 });

    expect(res.ok).toBe(true);
    const updatePayload = updateKeyMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload.duration_days).toBe(7);
    expect(updatePayload.expires_at).toBeInstanceOf(Date);
    expect((updatePayload.expires_at as Date).toISOString()).toBe("2026-01-11T23:59:59.999Z");
    vi.useRealTimers();
  });

  test("携带 durationDays 且当前已过期时，应清空 expiresAt 等待下次真实请求激活", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));
    findKeyByIdMock.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: new Date("2026-01-04T23:59:59.999Z"),
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const { editKey } = await import("@/actions/keys");
    const res = await editKey(1, { name: "k2", durationDays: 7 });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        duration_days: 7,
        expires_at: null,
      })
    );
    vi.useRealTimers();
  });

  test("同时携带 expiresAt 和 durationDays 时应校验失败", async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", expiresAt: "2026-01-04", durationDays: 7 });

    expect(res.ok).toBe(false);
  });

  test("携带 expiresAt 空串与 durationDays 时，会优先按清空 expiresAt 处理并清除 durationDays", async () => {
    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", expiresAt: "", durationDays: 7 });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledTimes(1);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expires_at: null,
        duration_days: null,
      })
    );
  });
  test("已激活相对有效期 Key 再次携带 durationDays 时应报错", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    findKeyByIdMock.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: new Date("2026-01-04T23:59:59.999Z"),
      durationDays: 7,
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const { editKey } = await import("@/actions/keys");

    const res = await editKey(1, { name: "k2", durationDays: 7 });

    expect(res.ok).toBe(false);
    expect(updateKeyMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("adjustRelativeKeyExpiry extend 应顺延到期时间", async () => {
    findKeyByIdMock.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: new Date("2026-01-04T23:59:59.999Z"),
      durationDays: 7,
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const { adjustRelativeKeyExpiry } = await import("@/actions/keys");
    const res = await adjustRelativeKeyExpiry(1, { mode: "extend", days: 3 });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expires_at: expect.any(Date),
      })
    );
    expect((updateKeyMock.mock.calls[0]?.[1].expires_at as Date).toISOString()).toBe(
      "2026-01-07T23:59:59.999Z"
    );
  });

  test("adjustRelativeKeyExpiry reduce 应提前到期时间", async () => {
    findKeyByIdMock.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: new Date("2026-01-04T23:59:59.999Z"),
      durationDays: 7,
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const { adjustRelativeKeyExpiry } = await import("@/actions/keys");
    const res = await adjustRelativeKeyExpiry(1, { mode: "reduce", days: 2 });

    expect(res.ok).toBe(true);
    expect((updateKeyMock.mock.calls[0]?.[1].expires_at as Date).toISOString()).toBe(
      "2026-01-02T23:59:59.999Z"
    );
  });
});

describe("renewKeyExpiresAt: 绝对续期语义", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findKeyByIdMock.mockResolvedValue({
      id: 1,
      userId: 10,
      key: "sk-test",
      name: "k",
      isEnabled: true,
      expiresAt: null,
      durationDays: 7,
      canLoginWebUi: true,
      limit5hUsd: null,
      limitDailyUsd: null,
      dailyResetMode: "fixed",
      dailyResetTime: "00:00",
      limitWeeklyUsd: null,
      limitMonthlyUsd: null,
      limitTotalUsd: null,
      limitConcurrentSessions: 0,
      providerGroup: "default",
      cacheTtlPreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    updateKeyMock.mockResolvedValue({ id: 1 });
  });

  test("快捷续期写入绝对 expires_at 时应清除 duration_days", async () => {
    const { renewKeyExpiresAt } = await import("@/actions/keys");

    const res = await renewKeyExpiresAt(1, { expiresAt: "2026-01-20T00:00:00.000Z" });

    expect(res.ok).toBe(true);
    expect(updateKeyMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expires_at: expect.any(Date),
        duration_days: null,
      })
    );
  });
});
