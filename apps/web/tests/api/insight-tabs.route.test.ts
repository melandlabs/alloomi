import { randomUUID } from "node:crypto";
import { describe, beforeAll, beforeEach, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuthUser = { id: string; type: "regular" };

const authState = vi.hoisted(() => ({
  user: {
    id: "user-tabs",
    type: "regular" as const,
  } as AuthUser | null,
}));

vi.mock("@/app/(auth)/auth", () => ({
  auth: async () => (authState.user ? { user: authState.user } : null),
  __setUser: (user: AuthUser | null) => {
    authState.user = user;
  },
}));

const dbState = vi.hoisted(() => ({
  tabs: new Map<string, any>(),
  tabsByUser: new Map<string, string[]>(),
}));

vi.mock("@/lib/db/queries", () => ({
  getUserInsightTabs: vi.fn(async (userId: string) => {
    const tabIds = dbState.tabsByUser.get(userId) || [];
    return tabIds
      .map((id) => dbState.tabs.get(id))
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }),
  createInsightTab: vi.fn(async (input: any) => {
    const tab = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      type: "custom",
      filter: input.filter,
      enabled: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbState.tabs.set(tab.id, tab);
    const userTabs = dbState.tabsByUser.get(input.userId) || [];
    dbState.tabsByUser.set(input.userId, [...userTabs, tab.id]);
    return tab;
  }),
  updateInsightTab: vi.fn(async (input: any) => {
    const tab = dbState.tabs.get(input.tabId);
    if (!tab || tab.userId !== input.userId) {
      return null;
    }
    const updated = {
      ...tab,
      ...input.payload,
      updatedAt: new Date(),
    };
    dbState.tabs.set(tab.id, updated);
    return updated;
  }),
  deleteInsightTab: vi.fn(async (input: any) => {
    const tab = dbState.tabs.get(input.tabId);
    if (!tab || tab.userId !== input.userId) {
      return null;
    }
    dbState.tabs.delete(input.tabId);
    const userTabs = dbState.tabsByUser.get(input.userId) || [];
    dbState.tabsByUser.set(
      input.userId,
      userTabs.filter((id) => id !== input.tabId),
    );
    return { id: input.tabId };
  }),
  reorderInsightTabs: vi.fn(async (input: any) => {
    for (let i = 0; i < input.tabIds.length; i++) {
      const tab = dbState.tabs.get(input.tabIds[i]);
      if (tab && tab.userId === input.userId) {
        tab.sortOrder = i;
        tab.updatedAt = new Date();
        dbState.tabs.set(tab.id, tab);
      }
    }
    return true;
  }),
  __reset: () => {
    dbState.tabs = new Map();
    dbState.tabsByUser = new Map();
  },
  __setTab: (tab: any) => {
    dbState.tabs.set(tab.id, tab);
    const userTabs = dbState.tabsByUser.get(tab.userId) || [];
    if (!userTabs.includes(tab.id)) {
      dbState.tabsByUser.set(tab.userId, [...userTabs, tab.id]);
    }
  },
  __getState: () => dbState,
}));

const authModulePromise = import("@/app/(auth)/auth");
const queriesModulePromise = import("@/lib/db/queries");

let authModule: any;
let queriesModule: any;

async function invokeGetTabs() {
  const request = new Request("http://localhost/api/insight-tabs", {
    method: "GET",
  }) as any;
  const { GET } = await import("@/app/api/insight-tabs/route");
  return GET(request);
}

async function invokeCreateTab(body: unknown) {
  const request = new Request("http://localhost/api/insight-tabs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
  const { POST } = await import("@/app/api/insight-tabs/route");
  return POST(request);
}

async function invokeUpdateTab(tabId: string, body: unknown) {
  const request = new Request(`http://localhost/api/insight-tabs/${tabId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
  const { PUT } = await import("@/app/api/insight-tabs/[tabId]/route");
  return PUT(request, { params: Promise.resolve({ id: tabId }) });
}

async function invokeDeleteTab(tabId: string) {
  const request = new Request(`http://localhost/api/insight-tabs/${tabId}`, {
    method: "DELETE",
  }) as any;
  const { DELETE } = await import("@/app/api/insight-tabs/[tabId]/route");
  return DELETE(request, { params: Promise.resolve({ id: tabId }) });
}

async function invokeReorderTabs(body: unknown) {
  const request = new Request("http://localhost/api/insight-tabs/reorder", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
  const { PUT } = await import("@/app/api/insight-tabs/reorder/route");
  return PUT(request);
}

describe("Insight Tabs API integration tests", () => {
  beforeAll(async () => {
    authModule = await authModulePromise;
    queriesModule = await queriesModulePromise;
  });

  beforeEach(() => {
    authModule.__setUser({ id: "user-tabs", type: "regular" });
    queriesModule.__reset();
  });

  describe("GET /api/insight-tabs", () => {
    test("[TABS-GET-01] returns empty array when user has no tabs", async () => {
      const response = await invokeGetTabs();
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tabs).toEqual([]);
    });

    test("[TABS-GET-02] returns user's tabs sorted by sortOrder", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "Important",
        sortOrder: 1,
      });
      queriesModule.__setTab({
        id: "tab-2",
        userId: "user-tabs",
        name: "Urgent",
        sortOrder: 0,
      });

      const response = await invokeGetTabs();
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tabs).toHaveLength(2);
      expect(payload.tabs[0].id).toBe("tab-2"); // sortOrder 0
      expect(payload.tabs[1].id).toBe("tab-1"); // sortOrder 1
    });

    test("[TABS-GET-03] rejects anonymous requests", async () => {
      authModule.__setUser(null);

      const response = await invokeGetTabs();
      expect(response.status).toBe(401);

      const payload = await response.json();
      expect(payload.error).toBe("Unauthorized");
    });

    test("[TABS-GET-04] only returns tabs owned by the authenticated user", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        sortOrder: 0,
      });
      queriesModule.__setTab({
        id: "tab-2",
        userId: "other-user",
        name: "Other Tab",
        sortOrder: 0,
      });

      const response = await invokeGetTabs();
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tabs).toHaveLength(1);
      expect(payload.tabs[0].id).toBe("tab-1");
    });
  });

  describe("POST /api/insight-tabs", () => {
    test("[TABS-CREATE-01] creates a new tab with valid payload", async () => {
      const response = await invokeCreateTab({
        name: "My Custom Tab",
        filter: {
          match: "all",
          conditions: [{ kind: "importance", values: ["Important"] }],
        },
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tab).toBeTruthy();
      expect(payload.tab.name).toBe("My Custom Tab");
      expect(payload.tab.type).toBe("custom");
      expect(payload.tab.enabled).toBe(true);
      expect(payload.tab.filter).toEqual({
        match: "all",
        conditions: [{ kind: "importance", values: ["Important"] }],
      });

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.size).toBe(1);
    });

    test("[TABS-CREATE-02] rejects requests missing name field", async () => {
      const response = await invokeCreateTab({
        filter: { match: "all", conditions: [] },
      });

      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.error).toBe("Missing required fields");

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.size).toBe(0);
    });

    test("[TABS-CREATE-03] rejects requests missing filter field", async () => {
      const response = await invokeCreateTab({
        name: "My Tab",
      });

      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.error).toBe("Missing required fields");
    });

    test("[TABS-CREATE-04] rejects anonymous requests", async () => {
      authModule.__setUser(null);

      const response = await invokeCreateTab({
        name: "My Tab",
        filter: { match: "all", conditions: [] },
      });

      expect(response.status).toBe(401);
      expect(queriesModule.__getState().tabs.size).toBe(0);
    });

    test("[TABS-CREATE-05] creates tab with complex filter definition", async () => {
      const response = await invokeCreateTab({
        name: "Complex Filter",
        filter: {
          match: "any",
          conditions: [
            { kind: "importance", values: ["Important"] },
            { kind: "urgency", values: ["ASAP"] },
            { kind: "keyword", value: "urgent", caseSensitive: false },
          ],
        },
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tab.filter.conditions).toHaveLength(3);
    });
  });

  describe("PUT /api/insight-tabs/:tabId", () => {
    test("[TABS-UPDATE-01] updates tab name", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "Old Name",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      const response = await invokeUpdateTab("tab-1", {
        name: "New Name",
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tab.name).toBe("New Name");
    });

    test("[TABS-UPDATE-02] updates tab filter", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      const newFilter = {
        match: "any",
        conditions: [{ kind: "importance", values: ["Important"] }],
      };

      const response = await invokeUpdateTab("tab-1", {
        filter: newFilter,
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tab.filter).toEqual(newFilter);
    });

    test("[TABS-UPDATE-03] updates tab enabled status", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        filter: { match: "all", conditions: [] },
        enabled: true,
        sortOrder: 0,
      });

      const response = await invokeUpdateTab("tab-1", {
        enabled: false,
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.tab.enabled).toBe(false);
    });

    test("[TABS-UPDATE-04] returns 404 for non-existent tab", async () => {
      const response = await invokeUpdateTab("non-existent", {
        name: "New Name",
      });

      expect(response.status).toBe(404);

      const payload = await response.json();
      expect(payload.error).toBe("Tab not found");
    });

    test("[TABS-UPDATE-05] prevents updating tabs owned by other users", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "other-user",
        name: "Other User Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      const response = await invokeUpdateTab("tab-1", {
        name: "Hacked Name",
      });

      expect(response.status).toBe(404);
    });

    test("[TABS-UPDATE-06] rejects anonymous requests", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      authModule.__setUser(null);

      const response = await invokeUpdateTab("tab-1", {
        name: "New Name",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/insight-tabs/:tabId", () => {
    test("[TABS-DELETE-01] deletes owned tab", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      const response = await invokeDeleteTab("tab-1");
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.has("tab-1")).toBe(false);
    });

    test("[TABS-DELETE-02] returns 404 for non-existent tab", async () => {
      const response = await invokeDeleteTab("non-existent");
      expect(response.status).toBe(404);

      const payload = await response.json();
      expect(payload.error).toBe("Tab not found");
    });

    test("[TABS-DELETE-03] prevents deleting tabs owned by other users", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "other-user",
        name: "Other User Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      const response = await invokeDeleteTab("tab-1");
      expect(response.status).toBe(404);

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.has("tab-1")).toBe(true);
    });

    test("[TABS-DELETE-04] rejects anonymous requests", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        filter: { match: "all", conditions: [] },
        sortOrder: 0,
      });

      authModule.__setUser(null);

      const response = await invokeDeleteTab("tab-1");
      expect(response.status).toBe(401);

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.has("tab-1")).toBe(true);
    });
  });

  describe("PUT /api/insight-tabs/reorder", () => {
    test("[TABS-REORDER-01] reorders tabs by updating sortOrder", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "Tab 1",
        sortOrder: 0,
      });
      queriesModule.__setTab({
        id: "tab-2",
        userId: "user-tabs",
        name: "Tab 2",
        sortOrder: 1,
      });
      queriesModule.__setTab({
        id: "tab-3",
        userId: "user-tabs",
        name: "Tab 3",
        sortOrder: 2,
      });

      const response = await invokeReorderTabs({
        tabIds: ["tab-3", "tab-1", "tab-2"],
      });

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);

      const dbSnapshot = queriesModule.__getState();
      expect(dbSnapshot.tabs.get("tab-3").sortOrder).toBe(0);
      expect(dbSnapshot.tabs.get("tab-1").sortOrder).toBe(1);
      expect(dbSnapshot.tabs.get("tab-2").sortOrder).toBe(2);
    });

    test("[TABS-REORDER-02] rejects invalid tabIds parameter", async () => {
      const response = await invokeReorderTabs({
        tabIds: "not-an-array",
      });

      expect(response.status).toBe(400);

      const payload = await response.json();
      expect(payload.error).toBe("Invalid tabIds");
    });

    test("[TABS-REORDER-03] rejects anonymous requests", async () => {
      authModule.__setUser(null);

      const response = await invokeReorderTabs({
        tabIds: ["tab-1", "tab-2"],
      });

      expect(response.status).toBe(401);
    });

    test("[TABS-REORDER-04] only reorders tabs owned by authenticated user", async () => {
      queriesModule.__setTab({
        id: "tab-1",
        userId: "user-tabs",
        name: "My Tab",
        sortOrder: 0,
      });
      queriesModule.__setTab({
        id: "tab-2",
        userId: "other-user",
        name: "Other Tab",
        sortOrder: 0,
      });

      const response = await invokeReorderTabs({
        tabIds: ["tab-2", "tab-1"],
      });

      expect(response.status).toBe(200);

      const dbSnapshot = queriesModule.__getState();
      // tab-1 should be reordered
      expect(dbSnapshot.tabs.get("tab-1").sortOrder).toBe(1);
      // tab-2 should not be reordered (different user)
      expect(dbSnapshot.tabs.get("tab-2").sortOrder).toBe(0);
    });
  });
});
