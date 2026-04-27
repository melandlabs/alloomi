import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDueJobsMock,
  recoverStuckJobsMock,
  startJobExecutionMock,
  completeJobExecutionMock,
} = vi.hoisted(() => ({
  getDueJobsMock: vi.fn(),
  recoverStuckJobsMock: vi.fn(),
  startJobExecutionMock: vi.fn(),
  completeJobExecutionMock: vi.fn(),
}));

const { runWeeklyInsightMaintenanceMock } = vi.hoisted(() => ({
  runWeeklyInsightMaintenanceMock: vi.fn(),
}));

const { getUserInsightSettingsMock, updateUserInsightSettingsMock } =
  vi.hoisted(() => ({
    getUserInsightSettingsMock: vi.fn(),
    updateUserInsightSettingsMock: vi.fn(),
  }));

vi.mock("@/lib/cron/service", () => ({
  getDueJobs: getDueJobsMock,
  recoverStuckJobs: recoverStuckJobsMock,
  startJobExecution: startJobExecutionMock,
  completeJobExecution: completeJobExecutionMock,
}));

vi.mock("@/lib/cron/executor", () => ({
  executeJob: vi.fn(),
}));

vi.mock("@/lib/env/constants", () => ({
  isTauriMode: vi.fn(() => true),
  DEFAULT_AI_MODEL: "gpt-5.4",
  AI_PROXY_BASE_URL: "http://localhost:3000/api/ai",
}));

vi.mock("@/lib/auth/token-manager", () => ({
  getCloudAuthToken: vi.fn(() => null),
}));

vi.mock("@/lib/db/index", () => ({
  db: {},
}));

vi.mock("@/lib/db/schema", () => ({
  characters: { id: "id", status: "status" },
}));

vi.mock("@/lib/db/queries", () => ({
  getUserInsightSettings: getUserInsightSettingsMock,
  updateUserInsightSettings: updateUserInsightSettingsMock,
}));

vi.mock("@/lib/insights/maintenance", () => ({
  runWeeklyInsightMaintenance: runWeeklyInsightMaintenanceMock,
}));

async function flushSchedulerWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("local scheduler insight maintenance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    getDueJobsMock.mockReset();
    recoverStuckJobsMock.mockReset();
    startJobExecutionMock.mockReset();
    completeJobExecutionMock.mockReset();
    getUserInsightSettingsMock.mockReset();
    updateUserInsightSettingsMock.mockReset();
    runWeeklyInsightMaintenanceMock.mockReset();

    getDueJobsMock.mockResolvedValue([]);
    recoverStuckJobsMock.mockResolvedValue(undefined);
    updateUserInsightSettingsMock.mockResolvedValue(undefined);
    runWeeklyInsightMaintenanceMock.mockResolvedValue({
      platform: "desktop",
      processedUserCount: 1,
      users: [],
    });
  });

  afterEach(async () => {
    try {
      const scheduler = await import("@/lib/cron/local-scheduler");
      scheduler.stopLocalScheduler();
      scheduler.setSchedulerUserId(undefined);
    } catch {
      // ignore cleanup failures during module reset
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("skips desktop maintenance when the persisted checkpoint is still within the weekly window", async () => {
    getUserInsightSettingsMock.mockResolvedValue({
      lastInsightMaintenanceRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const scheduler = await import("@/lib/cron/local-scheduler");
    scheduler.setSchedulerUserId("user-1");
    await scheduler.startLocalScheduler();
    await flushSchedulerWork();

    expect(getUserInsightSettingsMock).toHaveBeenCalledWith("user-1");
    expect(runWeeklyInsightMaintenanceMock).not.toHaveBeenCalled();
    expect(updateUserInsightSettingsMock).not.toHaveBeenCalled();
  });

  it("persists the desktop maintenance checkpoint after a successful run", async () => {
    getUserInsightSettingsMock.mockResolvedValue({
      lastInsightMaintenanceRunAt: null,
    });

    const scheduler = await import("@/lib/cron/local-scheduler");
    scheduler.setSchedulerUserId("user-1");
    await scheduler.startLocalScheduler();
    await flushSchedulerWork();

    expect(runWeeklyInsightMaintenanceMock).toHaveBeenCalledWith({
      platform: "desktop",
      userId: "user-1",
    });
    expect(updateUserInsightSettingsMock).toHaveBeenCalledTimes(1);
    expect(updateUserInsightSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        lastInsightMaintenanceRunAt: expect.any(Date),
      }),
    );
  });
});
