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
vi.mock("@/repository/key", () => ({
  createKey: createKeyMock,
  deleteKey: deleteKeyMock,
  findKeyList: findKeyListMock,
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
      expiresAt: expiresAtDate,
    });
    expect(createKeyMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(101);
      expect(result.data.username).toBe("alice");
      expect(result.data.expiresAt).toBe(expiresAtDate.toISOString());
      expect(result.data.isNewUser).toBe(true);
      expect(result.data.isNewKey).toBe(true);
      expect(result.data.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
      expect(createKeyMock).toHaveBeenCalledWith({
        user_id: 101,
        key: result.data.apiKey,
        name: "发货系统生成",
        is_enabled: true,
        expires_at: expiresAtDate,
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
      expiresAt: expiresAtDate,
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
        isNewUser: false,
        isNewKey: false,
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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(77);
      expect(result.data.username).toBe("carol");
      expect(result.data.isNewUser).toBe(false);
      expect(result.data.isNewKey).toBe(true);
      expect(result.data.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
    }
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
