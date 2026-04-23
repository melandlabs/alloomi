"use client";

import type { InsightResponse } from "@/components/insight-card";
import type { Insight } from "@/lib/db/schema";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import "@/i18n";
import { AvatarState, getAvatarConfigByState } from "@/components/agent-avatar";
import {
  deduplicateInsights,
  filterEmptyInsights,
  getInsightTime,
  hasOverdueTasks,
  hasTaskDueToday,
} from "@/components/agent/events-panel-utils";
import { useInsightAvatar } from "@/hooks/use-insight-avatar";
import { useInsightBriefCategory } from "@/hooks/use-insight-brief-category";
import { useInsightPagination } from "@/hooks/use-insight-data";
import { useInsightRefresh } from "@/hooks/use-insight-refresh";
import { useInsightWeights } from "@/hooks/use-insight-weights";
import { useIntegrations } from "@/hooks/use-integrations";
import type { ActionCategory } from "@/lib/insights/event-rank";
import { sortInsightsByEventRankEnhanced } from "@/lib/insights/event-rank";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { SWRInfiniteKeyedMutator } from "swr/infinite";

export type BriefMessageStats = {
  messageCount: number;
  insightCount: number;
  platforms: string[];
  platformMessageCounts?: Record<string, number>;
};

export interface UseBriefPanelStateProps {
  externalSelectedInsight?: Insight | null;
  /** When true, excludes manual platform insights from the list */
  excludeManualInsights?: boolean;
}

export interface UseBriefPanelStateReturn {
  // Data
  messageStats: BriefMessageStats | undefined;
  categorizedInsights: {
    urgent: Insight[];
    important: Insight[];
    monitor: Insight[];
    archive: Insight[];
  };
  renderedInsightsCount: number;
  hasAnyInsights: boolean;
  sortedInsights: Insight[]; // All insights (uncategorized)
  isSorting: boolean;
  isWeightsLoading: boolean; // Whether weight data is loading
  hasReachedEnd: boolean;
  isValidating: boolean;
  avatarConfig: ReturnType<typeof getAvatarConfigByState>;
  assistantName: string;
  accountsCount: number;
  briefHeaderTitle: string;
  // Selection and drawer
  effectiveSelectedInsight: Insight | null;
  selectedInsight: Insight | null;
  setSelectedInsight: (v: Insight | null) => void;
  isDrawerOpen: boolean;
  handleSelectInsight: (insight: Insight | null) => void;
  handleCloseDrawer: () => void;
  // Pagination
  incrementSize: () => void;
  // Categorization/drag & drop/expansion
  expandedCategories: Set<ActionCategory>;
  toggleCategory: (c: ActionCategory) => void;
  strikethroughInsights: Set<string>;
  toggleStrikethrough: (id: string) => void;
  draggedInsightId: string | null;
  /** Show empty drop zones on the next frame after drag starts, used to delay display and avoid layout changes that cancel drag */
  showEmptyDropZones: boolean;
  dragOverCategory: ActionCategory | null;
  handleDragStart: (e: React.DragEvent, insightId: string) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragEnter: (e: React.DragEvent, category: ActionCategory) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent, category: ActionCategory) => void;
  handleDrop: (e: React.DragEvent, targetCategory: ActionCategory) => void;
  /** Refresh list, for useInsightActions */
  mutateInsightList: SWRInfiniteKeyedMutator<InsightResponse[]>;
  /** Insight IDs currently in Today's Focus list (excluding explicitly removed in this session) */
  briefListInsightIds: Set<string>;
  /** Called after user confirms removal from Today's Focus */
  addExplicitlyUnpinnedId: (insightId: string) => void;
  /** Notify list to refresh (called when pinning/unpinning from details) */
  triggerListRefresh: () => void;
}

const statsFetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as BriefMessageStats;
};

/**
 * Brief panel state and data Hook
 * Centrally manages insights fetching, sorting, categorization, drag & drop, expansion, and selection states
 */
export function useBriefPanelState({
  externalSelectedInsight = null,
  excludeManualInsights = false,
}: UseBriefPanelStateProps = {}): UseBriefPanelStateReturn {
  const { t, i18n } = useTranslation();
  const { data } = useSession();
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [strikethroughInsights, setStrikethroughInsights] = useState<
    Set<string>
  >(new Set());
  const [draggedInsightId, setDraggedInsightId] = useState<string | null>(null);
  /** Show empty drop zones on the next frame after drag starts, to avoid layout changes at dragstart moment that cause browser to cancel drag */
  const [showEmptyDropZones, setShowEmptyDropZones] = useState(false);
  const [dragOverCategory, setDragOverCategory] =
    useState<ActionCategory | null>(null);
  const [userCategoryOverrides, setUserCategoryOverrides] = useState<
    Map<string, ActionCategory>
  >(new Map());
  const [expandedCategories, setExpandedCategories] = useState<
    Set<ActionCategory>
  >(new Set());
  // Initial value is empty, will be set in useEffect
  const [sortedInsights, setSortedInsights] = useState<Insight[]>([]);
  const [eventRankCategories, setEventRankCategories] = useState<
    Map<string, ActionCategory>
  >(new Map());
  const [isSorting, setIsSorting] = useState(false);
  /** Event IDs explicitly unpinned by the user in this session; no longer shown in the list and pin button shows as unpinned */
  const [explicitlyUnpinnedIds, setExplicitlyUnpinnedIds] = useState<
    Set<string>
  >(new Set());
  /** Event IDs that have been unpinned from the backend (persisted) */
  const [backendUnpinnedIds, setBackendUnpinnedIds] = useState<Set<string>>(
    new Set(),
  );
  /** Optimistic update: temporarily added events when pinning, not waiting for data refresh */
  const [optimisticPinnedInsights, setOptimisticPinnedInsights] = useState<
    Insight[]
  >([]);
  /** All pinned insights fetched from the backend (not time-limited) */
  const [allPinnedInsights, setAllPinnedInsights] = useState<Insight[]>([]);

  // Sync refs (must be after the related state definitions)
  // Optimization: merge into a single useEffect to reduce multiple renders
  useEffect(() => {
    userCategoryOverridesRef.current = userCategoryOverrides;
    optimisticPinnedInsightsRef.current = optimisticPinnedInsights;
    eventRankCategoriesRef.current = eventRankCategories;
  }, [userCategoryOverrides, optimisticPinnedInsights, eventRankCategories]);

  const dragTargetRef = useRef<ActionCategory | null>(null);
  const filteredInsightsRef = useRef<string>("");
  const lastPinnedIdsKeyRef = useRef<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /** Empty groups only show on the next frame after drag starts, to avoid drag being cancelled due to layout changes on dragstart */
  useEffect(() => {
    if (draggedInsightId === null) {
      setShowEmptyDropZones(false);
      return;
    }
    const id = requestAnimationFrame(() => setShowEmptyDropZones(true));
    return () => cancelAnimationFrame(id);
  }, [draggedInsightId]);

  // Ref used by event handlers (initialized later)
  const userCategoryOverridesRef = useRef(userCategoryOverrides);
  const optimisticPinnedInsightsRef = useRef<Insight[]>([]);
  const uniqueInsightsRef = useRef<Insight[]>([]);
  const eventRankCategoriesRef = useRef(new Map<string, ActionCategory>());
  // Debounced sync ref
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    mutateInsightList,
    insightData,
    hasReachedEnd,
    incrementSize,
    setDays,
    isValidating,
    briefData,
    setIncludeBriefData,
  } = useInsightPagination();

  // Enable Brief Data loading (fetch weights and category data in one go)
  useEffect(() => {
    setIncludeBriefData(true);
    setDays(30);
  }, [setIncludeBriefData, setDays]);

  const { accounts } = useIntegrations();
  const { assistantName } = useInsightAvatar();
  const insightIds = useMemo(
    () => (insightData?.items || []).map((i) => i.id),
    [insightData?.items],
  );

  // Always call useInsightWeights (required by React Hooks rules)
  const {
    weightMultipliers: rawWeightsFromHook,
    isLoading: isWeightsLoadingFromHook,
  } = useInsightWeights(insightIds);

  // Use briefData if available; otherwise use data returned from hook
  const rawWeightMultipliers = useMemo(() => {
    if (briefData?.weights) {
      const weightsMap = new Map<string, number>();
      Object.entries(briefData.weights).forEach(([id, weight]) => {
        weightsMap.set(id, weight);
      });
      return weightsMap;
    }
    return rawWeightsFromHook;
  }, [briefData, rawWeightsFromHook]);

  // Weight loading status: no need to wait when briefData exists
  const isWeightsLoading = useMemo(() => {
    if (briefData?.weights) return false;
    return isWeightsLoadingFromHook;
  }, [briefData, isWeightsLoadingFromHook]);

  // Stable weightMultipliers - convert Map to stable reference
  const weightMultipliers = useMemo(() => {
    // Only create new reference when Map has content
    if (rawWeightMultipliers.size === 0) {
      return new Map<string, number>();
    }
    // Create a new Map but keep the same content, avoid rebuilding on every render
    return new Map(rawWeightMultipliers);
  }, [rawWeightMultipliers]);

  const uniqueInsights = useMemo(() => {
    const items = insightData?.items || [];
    const deduplicatedById = deduplicateInsights(items, "id");
    const deduplicatedByTitle = deduplicateInsights(deduplicatedById, "title");
    return filterEmptyInsights(deduplicatedByTitle);
  }, [insightData?.items]);

  // Sync ref and state (must be after uniqueInsights definition)
  useEffect(() => {
    uniqueInsightsRef.current = uniqueInsights;
  }, [uniqueInsights]);

  const isFirstLanding = useMemo(
    () => uniqueInsights.length === 0,
    [uniqueInsights.length],
  );
  const { isRefreshing, handleRefresh } = useInsightRefresh(
    assistantName,
    isFirstLanding,
  );
  const avatarConfig = useMemo(
    () =>
      getAvatarConfigByState(
        isRefreshing ? AvatarState.REFRESHING : AvatarState.DEFAULT,
      ),
    [isRefreshing],
  );

  const briefHeaderTitle = useMemo(() => {
    const today = new Date();
    const isZh = i18n.language?.startsWith("zh") ?? false;
    const dateStr = isZh
      ? format(today, "MM/dd", { locale: zhCN })
      : format(today, "MMM d", { locale: enUS });
    return t("brief.titleWithDate", "Daily Focus for {{date}}", {
      date: dateStr,
    });
  }, [i18n.language, t]);

  const { data: messageStats } = useSWR<BriefMessageStats>(
    "/api/stats/messages",
    statsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  useEffect(() => {
    const handleAccountAuthorized = () => handleRefresh();
    window.addEventListener(
      "integration:accountAuthorized",
      handleAccountAuthorized,
    );
    return () =>
      window.removeEventListener(
        "integration:accountAuthorized",
        handleAccountAuthorized,
      );
  }, [handleRefresh]);

  useEffect(() => {
    const handleCategoryChange = (event: CustomEvent) => {
      const { insightId, category } = event.detail;
      setUserCategoryOverrides((prev) => {
        const next = new Map(prev);
        next.set(insightId, category);
        return next;
      });
    };
    window.addEventListener(
      "insightCategoryChanged",
      handleCategoryChange as EventListener,
    );

    // Listen for pin status changes, optimistic update state and trigger overrides refetch
    const handlePinStatusChange = async (
      event: CustomEvent<{ insightId: string; isPinned: boolean }>,
    ) => {
      const { insightId, isPinned } = event.detail;
      // Update backendUnpinnedIds
      setBackendUnpinnedIds((prev) => {
        const next = new Set(prev);
        if (isPinned) {
          next.delete(insightId);
        } else {
          next.add(insightId);
        }
        return next;
      });

      // Also update explicitlyUnpinnedIds: remove on pin, add on unpin
      setExplicitlyUnpinnedIds((prev) => {
        const next = new Set(prev);
        if (isPinned) {
          next.delete(insightId);
        } else {
          next.add(insightId);
        }
        return next;
      });

      // On pin, optimistic update: directly fetch event details from API and add to list
      if (isPinned) {
        // First get category from eventRankCategories
        let category =
          eventRankCategoriesRef.current.get(insightId) || "monitor";

        // Check if this event is already in uniqueInsights
        const foundInUniqueInsights = uniqueInsightsRef.current.some(
          (i) => i.id === insightId,
        );

        // If not found in uniqueInsights, fetch event details and category from API
        if (!foundInUniqueInsights) {
          try {
            // Fetch category and event details in parallel
            const [categoryRes, insightRes] = await Promise.all([
              fetch(`/api/insights/${insightId}/brief-category`, {
                method: "GET",
                credentials: "include",
              }),
              fetch(`/api/insights/${insightId}`, {
                credentials: "include",
              }),
            ]);

            if (categoryRes.ok) {
              const categoryResult = await categoryRes.json();
              if (categoryResult.data?.category) {
                category = categoryResult.data.category;
              }
            }

            if (insightRes.ok) {
              const insightResult = await insightRes.json();
              if (insightResult.data?.insight) {
                const insight = insightResult.data.insight;
                // Add to optimistic update list
                setOptimisticPinnedInsights((prev) => [...prev, insight]);
              }
            }
          } catch (err) {
            console.error("[BriefPanel] Failed to fetch insight:", err);
          }
        }

        // Whether or not we got the insight from API, set userCategoryOverrides
        // Use function form to ensure correct update
        setUserCategoryOverrides((prev) => {
          const next = new Map(prev);
          next.set(insightId, category);
          return next;
        });
        // Auto-expand that category (if not already expanded)
        setExpandedCategories((prev) => {
          const next = new Set(prev);
          if (!next.has(category)) {
            next.add(category);
          }
          return next;
        });
      } else {
        // On unpin, remove from optimistic list
        setOptimisticPinnedInsights((prev) =>
          prev.filter((i) => i.id !== insightId),
        );
      }

      // Trigger background data refresh (don't wait)
      mutateInsightList();

      // Force clear ref to trigger sortedInsights recalculation
      filteredInsightsRef.current = "";
      lastPinnedIdsKeyRef.current = "";
      setRefreshTrigger((prev) => prev + 1);

      // Only refetch overrides on unpin, on pin only do optimistic update
      if (!isPinned && data?.user?.id && uniqueInsightsRef.current.length > 0) {
        try {
          const response = await fetch(
            "/api/insights/brief-categories/overrides",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ insights: uniqueInsightsRef.current }),
            },
          );
          if (response.ok) {
            const result = await response.json();
            if (result.data?.overrides) {
              const overrides = new Map<string, ActionCategory>(
                Object.entries(result.data.overrides).map(([k, v]) => [
                  k,
                  v as ActionCategory,
                ]),
              );
              setUserCategoryOverrides(overrides);
            }
            if (result.data?.unpinnedIds) {
              setBackendUnpinnedIds(new Set(result.data.unpinnedIds));
            }
          }
        } catch (error) {
          console.error("[BriefPanel] Failed to refresh overrides:", error);
        }
      }
    };
    window.addEventListener(
      "insightPinStatusChanged",
      handlePinStatusChange as unknown as EventListener,
    );

    return () => {
      window.removeEventListener(
        "insightCategoryChanged",
        handleCategoryChange as EventListener,
      );
      window.removeEventListener(
        "insightPinStatusChanged",
        handlePinStatusChange as unknown as EventListener,
      );
    };
  }, [
    mutateInsightList,
    uniqueInsightsRef,
    eventRankCategoriesRef,
    data?.user?.id,
  ]);

  const filteredInsights = useMemo(() => {
    if (!uniqueInsights.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return uniqueInsights.filter((insight) => {
      if (insight.isArchived) return false;
      // When excludeManualInsights is true, skip manual insights and NULL platform insights (character-created)
      if (
        excludeManualInsights &&
        (!insight.platform || insight.platform === "manual")
      )
        return false;
      // Keep manually created tracking (platform === "manual")
      if (insight.platform === "manual") return true;
      const insightTime = getInsightTime(insight);
      const isGeneratedToday = insightTime >= today;
      const hasDueToday = hasTaskDueToday(insight, today);
      const hasOverdue = hasOverdueTasks(insight, today);
      const hasAnyTasks = [
        insight.myTasks,
        insight.waitingForMe,
        insight.waitingForOthers,
      ].some((tasks) => tasks?.length);
      const hasNextActions = !!insight.nextActions?.length;
      return (
        isGeneratedToday ||
        hasDueToday ||
        hasOverdue ||
        hasAnyTasks ||
        hasNextActions
      );
    });
  }, [uniqueInsights, excludeManualInsights]);

  const { updateInsightCategory } = useInsightBriefCategory();

  // Prefer API-returned briefData, otherwise fall back to individual requests
  // Use ref to avoid triggering the original API request repeatedly
  const hasUsedBriefData = useRef(false);

  useEffect(() => {
    // If briefData exists, use it directly, and only use it once
    if (briefData?.overrides && !hasUsedBriefData.current) {
      hasUsedBriefData.current = true;

      const overrides = new Map<string, ActionCategory>(
        Object.entries(briefData.overrides).map(([k, v]) => [
          k,
          v as ActionCategory,
        ]),
      );
      setUserCategoryOverrides(overrides);

      if (briefData.unpinnedIds) {
        setBackendUnpinnedIds(new Set(briefData.unpinnedIds));
      }

      if (briefData.pinnedInsights) {
        setAllPinnedInsights(briefData.pinnedInsights);
      }
      return;
    }

    // If briefData already exists but has been used, don't call the original API
    if (briefData?.overrides) {
      return;
    }

    // Otherwise use the original API request
    const applyUserOverrides = async () => {
      if (!data?.user?.id || !uniqueInsights.length) {
        setUserCategoryOverrides(new Map());
        return;
      }
      try {
        const response = await fetch(
          "/api/insights/brief-categories/overrides",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insights: uniqueInsights }),
          },
        );
        if (response.ok) {
          const result = await response.json();
          const overrides = new Map<string, ActionCategory>(
            Object.entries(result.data.overrides || {}).map(([k, v]) => [
              k,
              v as ActionCategory,
            ]),
          );
          setUserCategoryOverrides(overrides);
          // Replace unpinned insight IDs (rather than just adding)
          if (result.data.unpinnedIds) {
            setBackendUnpinnedIds(new Set(result.data.unpinnedIds));
          }
        }
      } catch (error) {
        console.error(
          "[BriefPanel] Failed to get user category overrides:",
          error,
        );
      }
    };
    applyUserOverrides();
  }, [uniqueInsights, data?.user?.id, briefData]);

  // Fetch all pinned insights (not time-limited)
  // Use ref to avoid triggering the original API request repeatedly
  const hasUsedBriefPinned = useRef(false);

  useEffect(() => {
    // If briefData exists, use it directly, and only use it once
    if (briefData?.pinnedInsights && !hasUsedBriefPinned.current) {
      hasUsedBriefPinned.current = true;
      setAllPinnedInsights(briefData.pinnedInsights);
      return;
    }

    // If briefData already exists but has been used, don't call the original API
    if (briefData?.pinnedInsights) {
      return;
    }

    // Otherwise use the original API request
    const fetchAllPinnedInsights = async () => {
      if (!data?.user?.id) return;
      try {
        const response = await fetch("/api/insights/brief-categories/pinned", {
          credentials: "include",
        });
        if (response.ok) {
          const result = await response.json();
          if (result.data?.insights) {
            setAllPinnedInsights(result.data.insights);
            // Remove currently pinned insights from backendUnpinnedIds
            const pinnedIds = result.data.insights.map((i: Insight) => i.id);
            setBackendUnpinnedIds((prev) => {
              const next = new Set(prev);
              for (const id of pinnedIds) {
                next.delete(id);
              }
              return next;
            });
          }
        }
      } catch (error) {
        console.error(
          "[BriefPanel] Failed to fetch all pinned insights:",
          error,
        );
      }
    };

    fetchAllPinnedInsights();
  }, [data?.user?.id, briefData]);

  const pinnedIdsKey = useMemo(
    () => Array.from(userCategoryOverrides.keys()).sort().join(","),
    [userCategoryOverrides],
  );

  // Optimization: create stable sorting dependency key, reduce useEffect trigger frequency
  // Merge multiple independent states into a stable key, only trigger recalculation when key data actually changes
  const sortingKey = useMemo(() => {
    const filteredIds = filteredInsights
      .map((i) => i.id)
      .sort()
      .join(",");
    const pinnedIds = pinnedIdsKey;
    const weightsKey = Array.from(weightMultipliers.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    const unpinnedKey = Array.from(backendUnpinnedIds).sort().join(",");
    return `${filteredIds}|${pinnedIds}|${weightsKey}|${unpinnedKey}`;
  }, [filteredInsights, pinnedIdsKey, weightMultipliers, backendUnpinnedIds]);

  useEffect(() => {
    const pinnedInsightIds = Array.from(userCategoryOverrides.keys());
    const pinnedInsights = uniqueInsights.filter(
      (i) => pinnedInsightIds.includes(i.id) && !i.isArchived,
    );
    // Merge: filteredInsights + pinnedInsights + pinnedFromBrief + optimisticPinnedInsights
    // Prefer briefData.pinnedInsights (returned directly from API) to avoid batch rendering
    const pinnedFromBrief = briefData?.pinnedInsights || [];
    const filteredIds = new Set(filteredInsights.map((f) => f.id));
    const pinnedIds = new Set(pinnedInsights.map((p) => p.id));
    const allPinnedIds = new Set(
      pinnedFromBrief.map((p: any) => (typeof p === "string" ? p : p.id)),
    );
    const allInsights: Insight[] = [
      ...filteredInsights,
      // Pinned insights from uniqueInsights
      ...pinnedInsights.filter(
        (p) =>
          !filteredIds.has(p.id) &&
          !(excludeManualInsights && (!p.platform || p.platform === "manual")),
      ),
      // All pinned insights from backend (not time-limited), filter out already included
      ...pinnedFromBrief.filter((p: any) => {
        const id = typeof p === "string" ? p : p.id;
        const insight = typeof p === "string" ? null : p;
        return (
          !filteredIds.has(id) &&
          !pinnedIds.has(id) &&
          !p.isArchived &&
          !(
            excludeManualInsights &&
            (!insight?.platform || insight?.platform === "manual")
          )
        );
      }),
      // Optimistically updated pinned insights
      ...optimisticPinnedInsights.filter(
        (o) =>
          !filteredIds.has(o.id) &&
          !pinnedIds.has(o.id) &&
          !allPinnedIds.has(o.id) &&
          !o.isArchived &&
          !(excludeManualInsights && (!o.platform || o.platform === "manual")),
      ),
    ];
    const insightIdsKey = allInsights
      .map((i) => i.id)
      .sort()
      .join(",");
    const shouldUpdate =
      insightIdsKey !== filteredInsightsRef.current ||
      pinnedIdsKey !== lastPinnedIdsKeyRef.current;
    if (!shouldUpdate) {
      return;
    }
    filteredInsightsRef.current = insightIdsKey;
    lastPinnedIdsKeyRef.current = pinnedIdsKey;

    // First sync set sortedInsights to avoid flickering
    setSortedInsights(allInsights);

    const updateSorting = async () => {
      if (!allInsights.length) {
        setSortedInsights([]);
        setEventRankCategories(new Map());
        return;
      }
      setIsSorting(true);
      try {
        const result = await sortInsightsByEventRankEnhanced(allInsights, {
          useLLMDependencies: false,
          maxInsightsForLLM: 100,
          llmTimeoutMs: 30000,
          weightMultipliers,
        });
        setSortedInsights(result.sorted);
        setEventRankCategories(result.categories);

        // Debounced sync to backend: events appearing in Today's Focus list carry keep-focused, consistent with pin state
        const ids = result.sorted.map((i) => i.id);
        // Pass the frontend-computed categories to the backend to avoid backend recomputing
        const categories: Record<string, string> = {};
        for (const [insightId, category] of result.categories) {
          categories[insightId] = category;
        }

        // Clear previous debounce timer
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        // 500ms debounce sync
        syncTimeoutRef.current = setTimeout(async () => {
          if (ids.length > 0 && data?.user?.id) {
            try {
              await fetch("/api/insights/brief-categories/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ insightIds: ids, categories }),
              });
            } catch (syncErr) {
              console.error(
                "[BriefPanel] Sync brief categories failed:",
                syncErr,
              );
            }
          }
        }, 500);
      } catch (error) {
        console.error("[BriefPanel] Failed to sort insights:", error);
        setSortedInsights(allInsights);
        setEventRankCategories(new Map());
      } finally {
        setIsSorting(false);
      }
    };
    updateSorting();
    // Optimization: use stable sortingKey instead of multiple independent dependencies, reduce unnecessary recalculation
  }, [
    sortingKey,
    uniqueInsights,
    data?.user?.id,
    refreshTrigger,
    optimisticPinnedInsights,
    briefData,
  ]);

  /** Insight IDs currently appearing in Today's Focus list (excluding those explicitly removed by user in this session and backend-recorded unpins) */
  const briefListInsightIds = useMemo(
    () =>
      new Set(
        sortedInsights
          .filter(
            (i) =>
              !explicitlyUnpinnedIds.has(i.id) && !backendUnpinnedIds.has(i.id),
          )
          .map((i) => i.id),
      ),
    [sortedInsights, explicitlyUnpinnedIds, backendUnpinnedIds],
  );

  const categorizedInsights = useMemo(() => {
    // Return categories even if weights are loading (use default values), to avoid flickering

    // Prefer briefData.pinnedInsights (returned directly from API) to avoid batch rendering
    const effectivePinned = briefData?.pinnedInsights?.length
      ? briefData.pinnedInsights
      : allPinnedInsights;

    // Create pinned insight ID set for checking if insight is pinned
    const pinnedInsightIds = new Set(
      effectivePinned.map((i: any) => (typeof i === "string" ? i : i.id)),
    );
    // Also check optimisticPinnedInsights
    optimisticPinnedInsights.forEach((i) => pinnedInsightIds.add(i.id));

    const categories: Record<ActionCategory, Insight[]> = {
      urgent: [],
      important: [],
      monitor: [],
      archive: [],
    };
    for (const insight of sortedInsights) {
      if (
        explicitlyUnpinnedIds.has(insight.id) ||
        backendUnpinnedIds.has(insight.id)
      )
        continue;
      // Prefer userCategoryOverrides (user-manually set, includes optimistic updates), then briefCategory, then eventRankCategories
      let category: ActionCategory;
      const insightWithBriefCategory = insight as Insight & {
        briefCategory?: string;
      };
      // Prefer user-manually set category (includes optimistic updates)
      const userOverride = userCategoryOverrides.get(insight.id);
      if (userOverride) {
        category = userOverride;
      } else if (insightWithBriefCategory.briefCategory) {
        category = insightWithBriefCategory.briefCategory as ActionCategory;
      } else {
        category = eventRankCategories.get(insight.id) || "archive";
      }
      // Pinned insights should not appear in archive category, automatically promote to monitor
      if (category === "archive" && pinnedInsightIds.has(insight.id)) {
        category = "monitor";
      }
      if (category in categories) {
        categories[category].push(insight);
      }
    }
    return categories;
  }, [
    sortedInsights,
    eventRankCategories,
    userCategoryOverrides,
    backendUnpinnedIds,
    explicitlyUnpinnedIds,
    allPinnedInsights,
    optimisticPinnedInsights,
    briefData,
  ]);

  const renderedInsightsCount = useMemo(
    () =>
      Object.values(categorizedInsights).reduce(
        (sum, list) => sum + list.length,
        0,
      ),
    [categorizedInsights],
  );

  const hasAnyInsights = useMemo(
    () => Object.values(categorizedInsights).some((items) => items.length > 0),
    [categorizedInsights],
  );

  const effectiveSelectedInsight = externalSelectedInsight ?? selectedInsight;

  const handleSelectInsight = useCallback((insight: Insight | null) => {
    setSelectedInsight(insight);
  }, []);

  useEffect(() => {
    setIsDrawerOpen(!!selectedInsight);
  }, [selectedInsight]);

  const handleCloseDrawer = useCallback(() => {
    handleSelectInsight(null);
    setIsDrawerOpen(false);
  }, [handleSelectInsight]);

  const toggleCategory = useCallback((category: ActionCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const toggleStrikethrough = useCallback((insightId: string) => {
    setStrikethroughInsights((prev) => {
      const next = new Set(prev);
      if (next.has(insightId)) next.delete(insightId);
      else next.add(insightId);
      return next;
    });
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, insightId: string) => {
      setDraggedInsightId(insightId);
      e.dataTransfer.effectAllowed = "move";
      /** Some browsers (like Firefox) require setData for drag to work */
      e.dataTransfer.setData("text/plain", insightId);
      const target = e.currentTarget as HTMLElement;
      setTimeout(() => {
        if (target) target.style.opacity = "0.5";
      }, 0);
    },
    [],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedInsightId(null);
    setDragOverCategory(null);
    dragTargetRef.current = null;
    const target = e.currentTarget as HTMLElement;
    if (target) target.style.opacity = "1";
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, category: ActionCategory) => {
      e.preventDefault();
      if (dragTargetRef.current !== category) {
        dragTargetRef.current = category;
        setDragOverCategory(category);
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent, category: ActionCategory) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { clientX: x, clientY: y } = e;
      if (
        x < rect.left ||
        x >= rect.right ||
        y < rect.top ||
        y >= rect.bottom
      ) {
        dragTargetRef.current = null;
        setDragOverCategory(null);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetCategory: ActionCategory) => {
      e.preventDefault();
      setDragOverCategory(null);
      dragTargetRef.current = null;
      if (!draggedInsightId) return;

      setUserCategoryOverrides((prev) => {
        const next = new Map(prev);
        next.set(draggedInsightId, targetCategory);
        return next;
      });

      try {
        await updateInsightCategory(draggedInsightId, targetCategory);
      } catch (error) {
        console.error("[BriefPanel] Failed to update insight category:", error);
      } finally {
        setDraggedInsightId(null);
      }
    },
    [draggedInsightId, updateInsightCategory],
  );

  /** Called after user confirms removal from Today's Focus, removes from current session list and marks as unpinned */
  const addExplicitlyUnpinnedId = useCallback((insightId: string) => {
    setExplicitlyUnpinnedIds((prev) => {
      const next = new Set(prev);
      next.add(insightId);
      return next;
    });
  }, []);

  /** Trigger list refresh */
  const triggerListRefresh = useCallback(() => {
    // Force clear ref to trigger recalculation
    filteredInsightsRef.current = "";
    lastPinnedIdsKeyRef.current = "";
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Listen for global refresh events
  useEffect(() => {
    const handleRefresh = () => {
      triggerListRefresh();
    };
    window.addEventListener("brief:refresh", handleRefresh);
    return () => window.removeEventListener("brief:refresh", handleRefresh);
  }, [triggerListRefresh]);

  return {
    messageStats,
    categorizedInsights,
    renderedInsightsCount,
    hasAnyInsights,
    sortedInsights,
    isSorting,
    isWeightsLoading,
    hasReachedEnd,
    isValidating,
    avatarConfig,
    assistantName,
    accountsCount: accounts.length,
    briefHeaderTitle,
    effectiveSelectedInsight,
    selectedInsight,
    setSelectedInsight,
    isDrawerOpen,
    handleSelectInsight,
    handleCloseDrawer,
    incrementSize,
    expandedCategories,
    toggleCategory,
    strikethroughInsights,
    toggleStrikethrough,
    draggedInsightId,
    showEmptyDropZones,
    dragOverCategory,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    mutateInsightList,
    briefListInsightIds,
    addExplicitlyUnpinnedId,
    triggerListRefresh,
  };
}
