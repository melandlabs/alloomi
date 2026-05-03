"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Insight } from "@/lib/db/schema";
import InsightDetailDrawer from "@/components/insight-detail-drawer";

export interface InsightDrawerOpenOptions {
  initialTab?: "digest" | "sources" | "attached" | "files";
  targetSourceDetailIds?: string[];
}

interface GlobalInsightDrawerContextValue {
  openDrawer: (insight: Insight, options?: InsightDrawerOpenOptions) => void;
  closeDrawer: () => void;
  isOpen: boolean;
}

const GlobalInsightDrawerContext =
  createContext<GlobalInsightDrawerContextValue | null>(null);

export function useGlobalInsightDrawer() {
  const context = useContext(GlobalInsightDrawerContext);
  if (!context) {
    throw new Error(
      "useGlobalInsightDrawer must be used within GlobalInsightDrawerProvider",
    );
  }
  return context;
}

export function useGlobalInsightDrawerOptional(): GlobalInsightDrawerContextValue | null {
  return useContext(GlobalInsightDrawerContext);
}

export function GlobalInsightDrawerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [openOptions, setOpenOptions] = useState<InsightDrawerOpenOptions>({});

  const openDrawer = (insight: Insight, options?: InsightDrawerOpenOptions) => {
    setSelectedInsight(insight);
    setOpenOptions(options ?? {});
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setSelectedInsight(null);
    setOpenOptions({});
    setIsOpen(false);
  };

  // Listen for global events: open insight detail drawer
  useEffect(() => {
    const handleOpenInsightDrawer = (event: CustomEvent<Insight>) => {
      const insight = event.detail;
      if (insight) {
        openDrawer(insight);
      }
    };

    window.addEventListener(
      "global:openInsightDrawer",
      handleOpenInsightDrawer as EventListener,
    );

    return () => {
      window.removeEventListener(
        "global:openInsightDrawer",
        handleOpenInsightDrawer as EventListener,
      );
    };
  }, []);

  return (
    <GlobalInsightDrawerContext.Provider
      value={{ openDrawer, closeDrawer, isOpen }}
    >
      {children}
      <InsightDetailDrawer
        insight={selectedInsight}
        isOpen={isOpen}
        onClose={closeDrawer}
        initialTab={openOptions.initialTab}
        targetSourceDetailIds={openOptions.targetSourceDetailIds}
      />
    </GlobalInsightDrawerContext.Provider>
  );
}
