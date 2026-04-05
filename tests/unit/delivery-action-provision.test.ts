import { beforeEach, describe, expect, test, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

const parseDateInputAsTimezoneMock = vi.fn();
vi.mock("@/lib/utils/date-input", () => ({
  parseDateInputAsTimezone: parseDateInputAsTimezoneMock,
}));

const resolveSystemTimezoneMock = vi.fn();
vi.mock("@/lib/utils/timezone", () => ({
  resolveSystemTimezone: resolveSystemTimezoneMock,
}));

const formatZodErrorMock = vi.fn();
vi.mock("@/lib/utils/zod-i18n", () => ({
  formatZodError: formatZodErrorMock,
}));

const createKeyMock = vi.fn();
const deleteKeyMock = vi.fn();
const findKeyListMock = vi.fn();
const updateKeyMock = vi.fn();
vi.mock("@/repository/key", () => ({
  createKey: createKeyMock,
  deleteKey: deleteKeyMock,
  findKeyList: findKeyListMock,
  updateKey: updateKeyMock,
}));

const createUserMock = vi.fn();
const findUserByNameMock = vi.fn();
const updateUserMock = vi.fn();
vi.mock("@/repository/user", () => ({
  createUser: createUserMock,
  findUserByName: findUserByNameMock,
  updateUser: updateUserMock,
}));

describe("delivery action provision", () => {
  const expiresAtDate = new Date("2026-12-31T15:59:59.000Z");

  beforeEach(() => {
    getSessionMock.mockReset();
    parseDateInputAsTimezoneMock.mockReset();
    resolveSystemTimezoneMock.mockReset();
    formatZodErrorMock.mockReset();
    createKeyMock.mockReset();
    deleteKeyMock.mockReset();
    findKeyListMock.mockReset();
    updateKeyMock.mockReset();
    createUserMock.mockReset();
    findUserByNameMock.mockReset();
    updateUserMock.mockReset();

    resolveSystemTimezoneMock.mockResolvedValue("Asia/Shanghai");
    parseDateInputAsTimezoneMock.mockReturnValue(expiresAtDate);
    formatZodErrorMock.mockReturnValue("参数错误");
  });

  test("returns error when session is missing", async () => {
    getSessionMock.mockResolvedValue(null);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "alice",
      expiresAt: "2026-12-31 23:59:59",
    });

    expect(result).toEqual({ ok: false, error: "需要管理员权限" });
  });

  test("returns validation error for missing expiry strategy", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "alice",
    });

    expect(formatZodErrorMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "参数错误" });
  });

  test("returns validation error for invalid payload", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "",
      expiresAt: "",
    });

    expect(formatZodErrorMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "参数错误" });
  });

  test("returns validation error when both expiry strategies are provided", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "alice",
      expiresAt: "2026-12-31 23:59:59",
      durationDays: 30,
    });

    expect(formatZodErrorMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: "参数错误" });
  });

  test("creates new user and key", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue(null);
    createUserMock.mockResolvedValue({ id: 101, name: "alice" });
    findKeyListMock.mockResolvedValue([]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "alice",
      expiresAt: "2026-12-31 23:59:59",
      dailyLimitUsd: 10,
      limitConcurrentSessions: 2,
    });

    expect(resolveSystemTimezoneMock).toHaveBeenCalledTimes(1);
    expect(parseDateInputAsTimezoneMock).toHaveBeenCalledWith(
      "2026-12-31 23:59:59",
      "Asia/Shanghai",
    );
    expect(createUserMock).toHaveBeenCalledWith({
      name: "alice",
      description: "发货系统自动创建",
      dailyQuota: 10,
      limitConcurrentSessions: 2,
      dailyResetMode: "rolling",
      dailyResetTime: undefined,
      expiresAt: expiresAtDate,
    });
    expect(createKeyMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(101);
      expect(result.data.username).toBe("alice");
      expect(result.data.expiresAt).toBe(expiresAtDate.toISOString());
      expect(result.data.durationDays).toBeNull();
      expect(result.data.isNewUser).toBe(true);
      expect(result.data.isNewKey).toBe(true);
      expect(result.data.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
      expect(createKeyMock).toHaveBeenCalledWith({
        user_id: 101,
        key: result.data.apiKey,
        name: "发货系统生成",
        is_enabled: true,
        expires_at: expiresAtDate,
        duration_days: null,
      });
    }
  });

  test("updates existing user and reuses existing key by default", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue({ id: 55, name: "bob" });
    findKeyListMock.mockResolvedValue([{ id: 9, key: "sk-existing" }]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "bob",
      expiresAt: "2026-12-31 23:59:59",
      dailyLimitUsd: 20,
      limitConcurrentSessions: 3,
    });

    expect(updateUserMock).toHaveBeenCalledWith(55, {
      dailyQuota: 20,
      limitConcurrentSessions: 3,
      dailyResetMode: "rolling",
      dailyResetTime: undefined,
      expiresAt: expiresAtDate,
    });
    expect(updateKeyMock).toHaveBeenCalledWith(9, {
      expires_at: expiresAtDate,
      duration_days: null,
    });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(createKeyMock).not.toHaveBeenCalled();
    expect(deleteKeyMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      data: {
        apiKey: "sk-existing",
        userId: 55,
        username: "bob",
        expiresAt: expiresAtDate.toISOString(),
        durationDays: null,
        isNewUser: false,
        isNewKey: false,
      },
    });
  });

  test("creates new user and key with relative expiry", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue(null);
    createUserMock.mockResolvedValue({ id: 202, name: "dave" });
    findKeyListMock.mockResolvedValue([]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "dave",
      durationDays: 30,
      dailyLimitUsd: 15,
    });

    expect(parseDateInputAsTimezoneMock).not.toHaveBeenCalled();
    expect(createUserMock).toHaveBeenCalledWith({
      name: "dave",
      description: "发货系统自动创建",
      dailyQuota: 15,
      limitConcurrentSessions: undefined,
      dailyResetMode: "rolling",
      dailyResetTime: undefined,
      expiresAt: undefined,
    });
    expect(createKeyMock).toHaveBeenCalledWith({
      user_id: 202,
      key: expect.stringMatching(/^sk-[0-9a-f]{32}$/),
      name: "发货系统生成",
      is_enabled: true,
      expires_at: null,
      duration_days: 30,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        apiKey: expect.stringMatching(/^sk-[0-9a-f]{32}$/),
        userId: 202,
        username: "dave",
        expiresAt: null,
        durationDays: 30,
        isNewUser: true,
        isNewKey: true,
      },
    });
  });

  test("regenerates keys when requested", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue({ id: 77, name: "carol" });
    findKeyListMock.mockResolvedValue([{ id: 1, key: "sk-old-1" }, { id: 2, key: "sk-old-2" }]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "carol",
      expiresAt: "2026-12-31 23:59:59",
      regenerateKey: true,
    });

    expect(deleteKeyMock).toHaveBeenCalledTimes(2);
    expect(deleteKeyMock).toHaveBeenNthCalledWith(1, 1);
    expect(deleteKeyMock).toHaveBeenNthCalledWith(2, 2);
    expect(createKeyMock).toHaveBeenCalledTimes(1);
    expect(createKeyMock).toHaveBeenCalledWith({
      user_id: 77,
      key: expect.stringMatching(/^sk-[0-9a-f]{32}$/),
      name: "发货系统生成",
      is_enabled: true,
      expires_at: expiresAtDate,
      duration_days: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(77);
      expect(result.data.username).toBe("carol");
      expect(result.data.expiresAt).toBe(expiresAtDate.toISOString());
      expect(result.data.durationDays).toBeNull();
      expect(result.data.isNewUser).toBe(false);
      expect(result.data.isNewKey).toBe(true);
      expect(result.data.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
    }
  });

  test("updates existing key with relative expiry by default", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue({ id: 88, name: "erin" });
    findKeyListMock.mockResolvedValue([{ id: 11, key: "sk-relative" }]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "erin",
      durationDays: 7,
      regenerateKey: false,
    });

    expect(parseDateInputAsTimezoneMock).not.toHaveBeenCalled();
    expect(updateKeyMock).toHaveBeenCalledWith(11, {
      expires_at: null,
      duration_days: 7,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        apiKey: "sk-relative",
        userId: 88,
        username: "erin",
        expiresAt: null,
        durationDays: 7,
        isNewUser: false,
        isNewKey: false,
      },
    });
  });

  test("regenerates key with relative expiry", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    findUserByNameMock.mockResolvedValue({ id: 99, name: "frank" });
    findKeyListMock.mockResolvedValue([{ id: 21, key: "sk-old" }]);

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "frank",
      durationDays: 14,
      regenerateKey: true,
    });

    expect(deleteKeyMock).toHaveBeenCalledWith(21);
    expect(createKeyMock).toHaveBeenCalledWith({
      user_id: 99,
      key: expect.stringMatching(/^sk-[0-9a-f]{32}$/),
      name: "发货系统生成",
      is_enabled: true,
      expires_at: null,
      duration_days: 14,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        apiKey: expect.stringMatching(/^sk-[0-9a-f]{32}$/),
        userId: 99,
        username: "frank",
        expiresAt: null,
        durationDays: 14,
        isNewUser: false,
        isNewKey: true,
      },
    });
  });

  test("returns thrown error message", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 1, role: "admin" } });
    resolveSystemTimezoneMock.mockRejectedValue(new Error("timezone failed"));

    const { provision } = await import("@/actions/delivery");
    const result = await provision({
      username: "alice",
      expiresAt: "2026-12-31 23:59:59",
    });

    expect(result).toEqual({ ok: false, error: "timezone failed" });
  });
});
